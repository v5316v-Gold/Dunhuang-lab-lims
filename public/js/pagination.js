
/**
 * 2026-08-11 通用分页器组件
 * 借鉴金现代 LIMS 通用分页设计
 *
 * 特性：
 *   - 10/20/50/100 条/页切换
 *   - 首页/上页/下页/末页
 *   - 跳转到指定页
 *   - 总记录数显示
 *   - 与现有 table-wrap 容器集成
 */

class Paginator {
  constructor(tableSelector, options = {}) {
    this.tableWrap = typeof tableSelector === 'string' ? document.querySelector(tableSelector) : tableSelector;
    if (!this.tableWrap) return;
    this.options = {
      pageSize: 20,
      pageSizes: [10, 20, 50, 100],
      ...options
    };
    this.currentPage = 1;
    this.allRows = [];
    this.filteredRows = [];
    this.init();
  }

  init() {
    // 找当前表中的所有行
    const tbody = this.tableWrap.querySelector('tbody');
    if (!tbody) return;
    this.allRows = Array.from(tbody.querySelectorAll('tr')).filter(r => !r.querySelector('td[colspan]'));
    this.filteredRows = [...this.allRows];
    this.renderPagination();
    this.goToPage(1);
  }

  // 重新加载（数据更新后）
  reload() {
    const tbody = this.tableWrap.querySelector('tbody');
    if (!tbody) return;
    this.allRows = Array.from(tbody.querySelectorAll('tr')).filter(r => !r.querySelector('td[colspan]'));
    this.filteredRows = [...this.allRows];
    this.renderPagination();
    this.goToPage(1);
  }

  // 设置筛选（与 AdvancedFilter 配合）
  setFilter(filterFn) {
    this.filteredRows = this.allRows.filter(filterFn);
    this.renderPagination();
    this.goToPage(1);
  }

  // 渲染分页 UI
  renderPagination() {
    let pagEl = this.tableWrap.parentElement.querySelector('.pagination');
    if (!pagEl) {
      pagEl = document.createElement('div');
      pagEl.className = 'pagination';
      this.tableWrap.parentElement.appendChild(pagEl);
    }

    const total = this.filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / this.options.pageSize));

    pagEl.innerHTML = `
      <div class="pagination-info">
        共 <strong>${total}</strong> 条记录
        <select class="pagination-size-select form-control" onchange="this.closest('.pagination').__pag.setPageSize(parseInt(this.value))">
          ${this.options.pageSizes.map(s => `<option value="${s}" ${s === this.options.pageSize ? 'selected' : ''}>${s} 条/页</option>`).join('')}
        </select>
      </div>
      <div class="pagination-controls">
        <button class="pagination-btn" data-page="first" ${this.currentPage === 1 ? 'disabled' : ''} title="首页">«</button>
        <button class="pagination-btn" data-page="prev" ${this.currentPage === 1 ? 'disabled' : ''} title="上页">‹</button>
        <span style="padding:0 8px;font-size:13px;">
          第 <input type="number" class="form-control" style="width:60px;display:inline-block;height:28px;text-align:center;" value="${this.currentPage}" min="1" max="${totalPages}" onchange="this.closest('.pagination').__pag.goToPage(parseInt(this.value))" /> 页 / 共 ${totalPages} 页
        </span>
        <button class="pagination-btn" data-page="next" ${this.currentPage === totalPages ? 'disabled' : ''} title="下页">›</button>
        <button class="pagination-btn" data-page="last" ${this.currentPage === totalPages ? 'disabled' : ''} title="末页">»</button>
      </div>
    `;
    pagEl.__pag = this;
    pagEl.querySelectorAll('.pagination-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.page;
        if (action === 'first') this.goToPage(1);
        else if (action === 'prev') this.goToPage(this.currentPage - 1);
        else if (action === 'next') this.goToPage(this.currentPage + 1);
        else if (action === 'last') this.goToPage(totalPages);
      });
    });
  }

  goToPage(page) {
    const total = this.filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / this.options.pageSize));
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    this.currentPage = page;

    // 隐藏所有行
    this.allRows.forEach(r => r.style.display = 'none');

    // 显示当前页
    const start = (page - 1) * this.options.pageSize;
    const end = start + this.options.pageSize;
    this.filteredRows.slice(start, end).forEach(r => r.style.display = '');

    this.renderPagination();
  }

  setPageSize(size) {
    this.options.pageSize = size;
    this.goToPage(1);
  }
}

window.Paginator = Paginator;
