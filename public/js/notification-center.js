
/**
 * 2026-08-11 实时通知中心
 * 借鉴金现代 LIMS 文档 L745-749 "消息提醒" + 文档 L345 "OA/钉钉/飞书"
 *
 * 架构：纯前端定时轮询（30s 一次）
 *   - 设备校准到期（equipment.next_calibration_date）
 *   - 设备维护到期（maintenance.next_maintenance_date）
 *   - 试剂过期预警（reagents.expiry_date）
 *   - 试剂库存不足（reagents.stock < min）
 *   - 样品待检测（sample.status=pending）
 *   - 隐患待处理（ehs_hazard.status=open）
 */

class NotificationCenter {
  constructor() {
    this.checkInterval = 30 * 1000; // 30 秒
    this.timer = null;
    this.alerts = []; // 当前活跃预警
    this.notifyList = []; // 已通知过的（避免重复）
    this.previousCount = 0;
  }

  start() {
    console.log('[NotificationCenter] 启动预警服务（每 ' + this.checkInterval / 1000 + 's 检查）');
    this.check(); // 立即检查
    this.timer = setInterval(() => this.check(), this.checkInterval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[NotificationCenter] 停止预警服务');
    }
  }

  async check() {
    try {
      // 并发请求所有需要监控的资源
      const requests = [
        this.fetchData('/api/equipment'),
        this.fetchData('/api/maintenance'),
        this.fetchData('/api/reagents'),
        this.fetchData('/api/samples'),
        this.fetchData('/api/ehs-hazard')
      ];
      const [equipment, maintenance, reagents, samples, hazards] = await Promise.all(requests);

      const newAlerts = [];

      // 1. 设备校准到期（30 天内）
      const today = new Date();
      const in30days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (equipment && equipment.data) {
        equipment.data.forEach(eq => {
          if (eq.next_calibration_date) {
            const calDate = new Date(eq.next_calibration_date);
            if (calDate < today) {
              newAlerts.push({
                type: 'alert',
                category: '设备校准',
                icon: 'alert-octagon',
                title: '设备 ' + eq.equip_no + ' 已逾期校准',
                desc: '应校准日期: ' + eq.next_calibration_date,
                severity: 'danger',
                action: '去校准',
                href: 'equipment'
              });
            } else if (calDate < in30days) {
              newAlerts.push({
                type: 'todo',
                category: '设备校准',
                icon: 'alert-triangle',
                title: '设备 ' + eq.equip_no + ' 即将校准',
                desc: '校准日期: ' + eq.next_calibration_date + '（' + this.daysBetween(today, calDate) + ' 天内）',
                severity: 'warning',
                action: '安排校准',
                href: 'equipment'
              });
            }
          }
        });
      }

      // 2. 设备维护到期
      if (maintenance && maintenance.data) {
        maintenance.data.forEach(m => {
          if (m.next_maintenance_date) {
            const mDate = new Date(m.next_maintenance_date);
            if (mDate < today) {
              newAlerts.push({
                type: 'todo',
                category: '设备维护',
                icon: 'tool',
                title: m.equip_name + ' 已逾期维护',
                desc: '应维护日期: ' + m.next_maintenance_date,
                severity: 'warning',
                action: '安排维护',
                href: 'maintenance'
              });
            }
          }
        });
      }

      // 3. 试剂过期 / 库存不足
      if (reagents && reagents.data) {
        reagents.data.forEach(r => {
          // 过期
          if (r.expiry_date) {
            const eDate = new Date(r.expiry_date);
            if (eDate < today) {
              newAlerts.push({
                type: 'alert',
                category: '试剂',
                icon: 'package-x',
                title: '试剂 ' + r.name + ' 已过期',
                desc: '过期日期: ' + r.expiry_date,
                severity: 'danger',
                action: '处理试剂',
                href: 'reagents'
              });
            } else if (eDate < in30days) {
              newAlerts.push({
                type: 'todo',
                category: '试剂',
                icon: 'clock',
                title: '试剂 ' + r.name + ' 即将过期',
                desc: '有效期: ' + r.expiry_date,
                severity: 'warning',
                action: '查看',
                href: 'reagents'
              });
            }
          }
          // 库存不足
          if (r.min_stock && r.stock < r.min_stock) {
            newAlerts.push({
              type: 'alert',
              category: '试剂',
              icon: 'package-minus',
              title: '试剂 ' + r.name + ' 库存不足',
              desc: '当前 ' + r.stock + r.unit + ' / 最低 ' + r.min_stock + r.unit,
              severity: 'danger',
              action: '采购',
              href: 'reagents'
            });
          }
        });
      }

      // 4. 样品待检测
      if (samples && samples.data) {
        const pending = samples.data.filter(s => s.status === 'pending' || s.status === 'received');
        if (pending.length > 0) {
          newAlerts.push({
            type: 'todo',
            category: '样品',
            icon: 'test-tube',
            title: '有 ' + pending.length + ' 个样品待检测',
            desc: '点击查看待检测列表',
            severity: 'info',
            action: '查看',
            href: 'appointments'
          });
        }
      }

      // 5. EHS 隐患
      if (hazards && hazards.data) {
        const open = hazards.data.filter(h => h.status === 'open' || h.status === '待处理');
        if (open.length > 0) {
          newAlerts.push({
            type: 'alert',
            category: 'EHS',
            icon: 'alert-triangle',
            title: '有 ' + open.length + ' 个隐患待处理',
            desc: '安全风险，需立即处理',
            severity: 'danger',
            action: '查看',
            href: 'ehs-hazard'
          });
        }
      }

      this.alerts = newAlerts;
      this.updateUI();

      // 如果新增了预警，桌面通知 + 声音
      if (newAlerts.length > this.previousCount && this.previousCount > 0) {
        const newCount = newAlerts.length - this.previousCount;
        showToast('新增 ' + newCount + ' 条预警', 'warning', 4000);
        this.playSound();
        this.showDesktopNotification(newCount);
      }
      this.previousCount = newAlerts.length;

    } catch (e) {
      console.warn('[NotificationCenter] check failed:', e.message);
    }
  }

  async fetchData(url) {
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) return { data: [] };
    return await resp.json();
  }

  daysBetween(d1, d2) {
    return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  // 更新 UI
  updateUI() {
    // 1. 更新消息中心 badge
    const bell = document.querySelector('.home-action-btn[title="消息中心"]');
    if (bell) {
      if (this.alerts.length > 0) {
        bell.classList.add('has-unread');
        // 更新 badge
        let badge = bell.querySelector('.notif-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'notif-badge';
          badge.style.cssText = 'position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;background:#C04851;color:#fff;border-radius:9px;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:600;padding:0 4px;border:2px solid #fff;';
          bell.style.position = 'relative';
          bell.appendChild(badge);
        }
        badge.textContent = this.alerts.length > 99 ? '99+' : this.alerts.length;
      } else {
        bell.classList.remove('has-unread');
        const badge = bell.querySelector('.notif-badge');
        if (badge) badge.remove();
      }
    }

    // 2. 推送到 MessageCenter
    if (window.MessageCenter && window.MessageCenter._injectAlerts) {
      window.MessageCenter._injectAlerts(this.alerts);
    }

    // 3. 桌面通知（如果不在前台）
    if (document.hidden && this.alerts.length > 0) {
      this.showDesktopNotification(this.alerts.length);
    }
  }

  // 播放预警音
  playSound() {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRlIFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YS4FAAB+f3+Af39/f39/f39/f39/f39/f39/f39/f39/');
      audio.volume = 0.1;
      audio.play().catch(() => {});
    } catch (e) {}
  }

  // 桌面通知
  showDesktopNotification(count) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification('敦煌金 LIMS 预警', {
        body: '您有 ' + count + ' 条新预警',
        icon: '/favicon.ico',
        tag: 'lims-alert'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  // 手动触发一次检查
  checkNow() {
    return this.check();
  }
}

// 全局实例
window.notificationCenter = new NotificationCenter();

// 登录后自动启动
document.addEventListener('DOMContentLoaded', function() {
  // 等登录完成（autoBoot 完成后）
  setTimeout(() => {
    if (window.currentUser && window.notificationCenter) {
      window.notificationCenter.start();
    }
  }, 2000);
});
