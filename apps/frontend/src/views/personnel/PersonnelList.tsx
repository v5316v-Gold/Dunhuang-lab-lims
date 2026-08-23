// =====================================================
// 人员管理列表 — 详情/培训/能力授权(MFA)/能力矩阵
// 功能: 人员列表 + 详情 Drawer + 培训 + 能力 + 矩阵
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useState } from 'react';
import {
  App,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import {
  AppstoreOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';
import { MfaChallengeModal } from '../../components/MfaChallengeModal';

// ---------- 类型 ----------
interface PersonnelRow {
  id: string;
  employeeNo: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  user?: { id: string; username: string; role: string; name?: string | null } | null;
}

interface PersonnelDetail extends PersonnelRow {
  gender?: string | null;
  education?: string | null;
  certNo?: string | null;
  hiredate?: string | null;
  trainings: Training[];
  competencies: Competency[];
}

interface Training {
  id: string;
  trainingType: string;
  trainingName: string;
  trainingDate: string;
  durationHours?: string | null;
  trainer?: string | null;
  content?: string | null;
  result?: string | null;
  certificateNo?: string | null;
}

interface Competency {
  id: string;
  method: string;
  level: string;
  certifiedAt: string;
  expiresAt: string;
  remarks?: string | null;
}

interface UserOption {
  id: string;
  name?: string | null;
  username: string;
  role?: string;
}

type CompetencyMatrix = Record<string, { employeeNo: string; name: string; [method: string]: string }>;

// ---------- 选项 ----------
const METHOD_OPTS = [
  { value: 'FIRE_ASSAY', label: '火试金法' },
  { value: 'ICP_OES', label: 'ICP-OES' },
  { value: 'ICP_MS', label: 'ICP-MS' },
  { value: 'XRF', label: 'X 荧光' },
  { value: 'GRAVIMETRY', label: '重量法' },
  { value: 'VOLUMETRY', label: '容量法' },
  { value: 'FIRE_ASSAY_GRAVIMETRY', label: '火试金·重量法' },
];

const TRAINING_RESULT_OPTS = [
  { value: 'PASS', label: '通过' },
  { value: 'EXCELLENT', label: '优秀' },
  { value: 'FAIL', label: '未通过' },
];

const LEVEL_OPTS = [
  { value: 'TRAINEE', label: '实习(TRAINEE)' },
  { value: 'JUNIOR', label: '初级(JUNIOR)' },
  { value: 'SENIOR', label: '高级(SENIOR)' },
  { value: 'EXPERT', label: '专家(EXPERT)' },
];

const inputStyle = { background: 'var(--bg-tertiary)', color: 'var(--text-primary)' } as const;

export function PersonnelList() {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [nameFilter, setNameFilter] = useState('');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const [detailId, setDetailId] = useState<string | null>(null);

  const [trainingTarget, setTrainingTarget] = useState<PersonnelRow | null>(null);
  const [trainingForm] = Form.useForm();

  const [compTarget, setCompTarget] = useState<PersonnelRow | null>(null);
  const [compForm] = Form.useForm();
  const [mfaOpen, setMfaOpen] = useState(false);

  const [matrixOpen, setMatrixOpen] = useState(false);

  // ---------- Queries ----------
  const listQuery = useQuery({
    queryKey: ['personnel-list', nameFilter, page],
    queryFn: async () =>
      (
        await api.get<{ data: PersonnelRow[]; total: number }>('/personnel', {
          params: { page, pageSize: 20, name: nameFilter || undefined },
        })
      ).data,
  });

  const detailQuery = useQuery({
    queryKey: ['personnel-detail', detailId],
    queryFn: async () => (await api.get<PersonnelDetail>(`/personnel/${detailId}`)).data,
    enabled: !!detailId,
  });

  const usersQuery = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => (await api.get<{ data: UserOption[] }>('/users', { params: { pageSize: 100 } })).data,
  });

  const matrixQuery = useQuery({
    queryKey: ['personnel-matrix'],
    queryFn: async () => (await api.get<CompetencyMatrix>('/personnel/matrix/competencies')).data,
    enabled: matrixOpen,
  });

  // ---------- Mutations ----------
  const createMut = useMutation({
    mutationFn: async (values: any) => (await api.post('/personnel', values)).data,
    onSuccess: () => {
      message.success('人员已创建');
      setCreateOpen(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ['personnel-list'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '创建失败'),
  });

  const submitTraining = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) =>
      (await api.post(`/personnel/${id}/trainings`, values)).data,
    onSuccess: () => {
      message.success('培训记录已登记');
      setTrainingTarget(null);
      trainingForm.resetFields();
      qc.invalidateQueries({ queryKey: ['personnel-detail'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '登记失败'),
  });

  const submitCompetency = useMutation({
    mutationFn: async ({ id, values, mfaToken }: { id: string; values: any; mfaToken: string }) =>
      (
        await api.post(`/personnel/${id}/competencies`, values, {
          headers: { 'x-mfa-token': mfaToken },
        })
      ).data,
    onSuccess: () => {
      message.success('能力授权已登记');
      setCompTarget(null);
      compForm.resetFields();
      setMfaOpen(false);
      qc.invalidateQueries({ queryKey: ['personnel-detail'] });
      qc.invalidateQueries({ queryKey: ['personnel-matrix'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '授权失败'),
  });

  // 删除人员(软删,仅无培训/能力记录)
  const removeMut = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/personnel/${id}`)).data,
    onSuccess: () => {
      message.success('人员档案已删除');
      qc.invalidateQueries({ queryKey: ['personnel-list'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '删除失败'),
  });

  // 撤销能力授权(立即失效)
  const revokeMut = useMutation({
    mutationFn: async (competencyId: string) => (await api.post(`/personnel/competencies/${competencyId}/revoke`)).data,
    onSuccess: () => {
      message.success('能力授权已撤销(立即失效)');
      qc.invalidateQueries({ queryKey: ['personnel-detail'] });
      qc.invalidateQueries({ queryKey: ['personnel-matrix'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '撤销失败'),
  });

  // ---------- 列 ----------
  const columns = [
    { title: '工号', dataIndex: 'employeeNo', width: 100 },
    { title: '姓名', dataIndex: 'name', width: 120 },
    { title: '职称', dataIndex: 'title', width: 120, render: (v?: string) => v ?? '—' },
    {
      title: '登录账号',
      dataIndex: ['user', 'username'],
      width: 120,
      render: (v: string | undefined) =>
        v ? <Tag style={{ color: 'var(--gold)' }}>{v}</Tag> : '—',
    },
    { title: '联系电话', dataIndex: 'phone', width: 130, render: (v?: string) => v ?? '—' },
    { title: '邮箱', dataIndex: 'email', ellipsis: true, render: (v?: string) => v ?? '—' },
    {
      title: '操作',
      width: 230,
      fixed: 'right' as const,
      render: (_: any, r: PersonnelRow) => (
        <Space size={4} wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(r.id)}>
            详情
          </Button>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<TrophyOutlined />}
            onClick={() => {
              setTrainingTarget(r);
              trainingForm.resetFields();
            }}
          >
            培训
          </Button>
          <Button
            size="small"
            icon={<SafetyCertificateOutlined />}
            onClick={() => {
              setCompTarget(r);
              compForm.resetFields();
              setMfaOpen(true);
            }}
          >
            授权
          </Button>
          <Popconfirm
            title="删除人员档案"
            description="仅无培训/能力记录的人员可删除(软删)。"
            onConfirm={() => removeMut.mutate(r.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={removeMut.isPending}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const list = listQuery.data;
  const total = list?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="人员管理"
        subtitle="CNAS §7.2 人员 · 培训 + 能力矩阵"
        icon={<TeamOutlined />}
        extra={
          <Space>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索姓名"
              style={{ width: 180 }}
              value={nameFilter}
              onChange={(e) => {
                setNameFilter(e.target.value);
                setPage(1);
              }}
            />
            <Button icon={<AppstoreOutlined />} onClick={() => setMatrixOpen(true)}>
              能力矩阵
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['personnel-list'] })}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
              style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }}
            >
              创建人员
            </Button>
          </Space>
        }
      />

      <DataTable<PersonnelRow>
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={list?.data ?? []}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: (p) => setPage(p),
        }}
        scroll={{ x: 980 }}
        locale={{ emptyText: '暂无人员' }}
        columns={columns as any}
      />

      {/* 创建 */}
      <Modal
        title="创建人员档案"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMut.isPending}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={(values) => {
            const dto = {
              userId: values.userId,
              employeeNo: values.employeeNo,
              name: values.name,
              phone: values.phone,
              email: values.email,
              title: values.title,
              gender: values.gender,
              education: values.education,
              certNo: values.certNo,
              hiredate: values.hiredate ? (values.hiredate as Dayjs).format('YYYY-MM-DD') : undefined,
            };
            createMut.mutate(dto);
          }}
        >
          <Form.Item name="userId" label="关联用户" rules={[{ required: true, message: '请选择关联用户' }]}>
            <Select
              showSearch
              placeholder="选择系统用户(可搜索姓名/账号)"
              optionFilterProp="label"
              options={(usersQuery.data?.data ?? []).map((u) => ({
                value: u.id,
                label: `${u.name ?? u.username} (${u.username})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="employeeNo" label="工号" rules={[{ required: true }]}>
            <Input style={inputStyle} placeholder="如:P001" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="gender" label="性别">
            <Select
              allowClear
              options={[
                { value: 'M', label: '男' },
                { value: 'F', label: '女' },
              ]}
            />
          </Form.Item>
          <Form.Item name="phone" label="联系电话">
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="title" label="职称">
            <Input style={inputStyle} placeholder="如:工程师" />
          </Form.Item>
          <Form.Item name="education" label="学历">
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="certNo" label="职业证书编号">
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="hiredate" label="入职日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title={
          detailQuery.data ? `${detailQuery.data.employeeNo} · ${detailQuery.data.name}` : '人员详情'
        }
        width={760}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        loading={detailQuery.isLoading}
      >
        {detailQuery.data && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="工号">{detailQuery.data.employeeNo}</Descriptions.Item>
              <Descriptions.Item label="姓名">{detailQuery.data.name}</Descriptions.Item>
              <Descriptions.Item label="登录账号">
                {detailQuery.data.user?.username ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="角色">
                {detailQuery.data.user?.role ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="性别">{detailQuery.data.gender ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="职称">{detailQuery.data.title ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="电话">{detailQuery.data.phone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{detailQuery.data.email ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="学历">{detailQuery.data.education ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="证书编号">{detailQuery.data.certNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="入职日期" span={2}>
                {detailQuery.data.hiredate?.substring(0, 10) ?? '—'}
              </Descriptions.Item>
            </Descriptions>

            <h4 style={{ color: 'var(--gold)' }}>培训记录({detailQuery.data.trainings.length})</h4>
            <Table<Training>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detailQuery.data.trainings}
              locale={{ emptyText: '暂无培训记录' }}
              columns={[
                { title: '日期', dataIndex: 'trainingDate', width: 110, render: (v: string) => v?.substring(0, 10) },
                { title: '类型', dataIndex: 'trainingType', width: 100 },
                { title: '培训名称', dataIndex: 'trainingName', ellipsis: true },
                { title: '时长(h)', dataIndex: 'durationHours', width: 80 },
                { title: '讲师', dataIndex: 'trainer', width: 100 },
                {
                  title: '结果',
                  dataIndex: 'result',
                  width: 80,
                  render: (v?: string) => {
                    const color = v === 'EXCELLENT' ? 'gold' : v === 'PASS' ? 'success' : v === 'FAIL' ? 'error' : 'default';
                    const label = TRAINING_RESULT_OPTS.find((o) => o.value === v)?.label ?? v;
                    return v ? <Tag color={color}>{label}</Tag> : '—';
                  },
                },
                { title: '证书编号', dataIndex: 'certificateNo', width: 130 },
              ]}
              style={{ marginBottom: 16 }}
            />

            <h4 style={{ color: 'var(--gold)' }}>
              能力授权({detailQuery.data.competencies.length})
            </h4>
            <Table<Competency>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detailQuery.data.competencies}
              locale={{ emptyText: '暂无能力授权' }}
              columns={[
                {
                  title: '方法',
                  dataIndex: 'method',
                  width: 130,
                  render: (v: string) => METHOD_OPTS.find((o) => o.value === v)?.label ?? v,
                },
                {
                  title: '等级',
                  dataIndex: 'level',
                  width: 100,
                  render: (v: string) => {
                    const color =
                      v === 'EXPERT' ? 'gold' : v === 'SENIOR' ? 'processing' : v === 'JUNIOR' ? 'success' : 'default';
                    return <Tag color={color}>{v}</Tag>;
                  },
                },
                { title: '授权日期', dataIndex: 'certifiedAt', width: 110, render: (v: string) => v?.substring(0, 10) },
                { title: '有效期', dataIndex: 'expiresAt', width: 110, render: (v: string) => v?.substring(0, 10) },
                { title: '备注', dataIndex: 'remarks', ellipsis: true, render: (v?: string) => v ?? '—' },
                {
                  title: '', width: 70,
                  render: (_: any, c: Competency) => (
                    <Popconfirm
                      title="撤销能力授权"
                      description={`撤销 ${c.method} 授权?立即失效。`}
                      onConfirm={() => revokeMut.mutate(c.id)}
                    >
                      <Button size="small" danger icon={<StopOutlined />} loading={revokeMut.isPending}>撤销</Button>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>

      {/* 培训登记 */}
      <Modal
        title={trainingTarget ? `登记培训 · ${trainingTarget.name}` : '登记培训'}
        open={!!trainingTarget}
        onCancel={() => setTrainingTarget(null)}
        onOk={() => trainingForm.submit()}
        confirmLoading={submitTraining.isPending}
        okText="登记"
        cancelText="取消"
        width={560}
      >
        <Form
          form={trainingForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={(values) =>
            submitTraining.mutate({
              id: trainingTarget!.id,
              values: {
                trainingType: values.trainingType,
                trainingName: values.trainingName,
                trainingDate: (values.trainingDate as Dayjs).format('YYYY-MM-DD'),
                durationHours: values.durationHours !== undefined && values.durationHours !== null ? String(values.durationHours) : undefined,
                trainer: values.trainer,
                content: values.content,
                result: values.result,
                certificateNo: values.certificateNo,
              },
            })
          }
        >
          <Form.Item name="trainingType" label="培训类型" rules={[{ required: true }]} initialValue="INTERNAL">
            <Select
              options={[
                { value: 'INTERNAL', label: '内部培训' },
                { value: 'EXTERNAL', label: '外部培训' },
                { value: 'ON_JOB', label: '在岗培训' },
                { value: 'STANDARD', label: '标准培训' },
              ]}
            />
          </Form.Item>
          <Form.Item name="trainingName" label="培训名称" rules={[{ required: true }]}>
            <Input style={inputStyle} placeholder="如:GB/T 9288 火试金法" />
          </Form.Item>
          <Form.Item name="trainingDate" label="培训日期" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="durationHours" label="培训时长(小时)">
            <Input placeholder="如:8" />
          </Form.Item>
          <Form.Item name="trainer" label="讲师">
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="result" label="考核结果">
            <Select allowClear options={TRAINING_RESULT_OPTS} />
          </Form.Item>
          <Form.Item name="certificateNo" label="证书编号">
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="content" label="培训内容">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 能力授权(MFA) */}
      <Modal
        title={compTarget ? `能力授权 · ${compTarget.name} (MFA)` : '能力授权'}
        open={!!compTarget && !mfaOpen}
        onCancel={() => setCompTarget(null)}
        onOk={() => setMfaOpen(true)}
        okText="下一步(MFA 验证)"
        cancelText="取消"
        width={560}
      >
        <Form
          form={compForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          // 提交按钮由外层控制 onOk
        >
          <Form.Item name="method" label="检测方法" rules={[{ required: true }]}>
            <Select options={METHOD_OPTS} placeholder="选择授权方法" />
          </Form.Item>
          <Form.Item name="level" label="等级" rules={[{ required: true }]} initialValue="JUNIOR">
            <Select options={LEVEL_OPTS} />
          </Form.Item>
          <Form.Item name="certifiedAt" label="授权日期" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="expiresAt"
            label="有效期至"
            rules={[{ required: true }]}
            initialValue={dayjs().add(2, 'year')}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} placeholder="如:依据 CNAS-CL01:2018 §7.2" />
          </Form.Item>
        </Form>
      </Modal>

      <MfaChallengeModal
        open={mfaOpen && !!compTarget}
        title="MFA 二次验证 · 能力授权"
        description={`为 ${compTarget?.name ?? ''} 授权检测方法需二次验证(CNAS §7.2 敏感操作)。`}
        onCancel={() => {
          setMfaOpen(false);
        }}
        onConfirm={async (mfaToken) => {
          if (!compTarget) return;
          const values = await compForm.validateFields();
          await submitCompetency.mutateAsync({
            id: compTarget.id,
            values: {
              method: values.method,
              level: values.level,
              certifiedAt: (values.certifiedAt as Dayjs).format('YYYY-MM-DD'),
              expiresAt: (values.expiresAt as Dayjs).format('YYYY-MM-DD'),
              remarks: values.remarks,
            },
            mfaToken,
          });
        }}
      />

      {/* 能力矩阵 */}
      <Modal
        title="能力矩阵(CNAS §7.2 人员-方法-等级)"
        open={matrixOpen}
        onCancel={() => setMatrixOpen(false)}
        footer={<Button onClick={() => setMatrixOpen(false)}>关闭</Button>}
        width={920}
      >
        {matrixQuery.isLoading ? (
          <div style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>加载中…</div>
        ) : !matrixQuery.data || Object.keys(matrixQuery.data).length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>暂无能力矩阵数据</div>
        ) : (
          (() => {
            const matrix = matrixQuery.data!;
            const methodSet = new Set<string>();
            for (const id of Object.keys(matrix)) {
              for (const k of Object.keys(matrix[id])) {
                if (k !== 'employeeNo' && k !== 'name') methodSet.add(k);
              }
            }
            const methods = Array.from(methodSet);
            const rows = Object.entries(matrix).map(([id, row]) => ({
              id,
              employeeNo: row.employeeNo,
              name: row.name,
              methods: methods.map((m) => ({ method: m, level: row[m] ?? null })),
            }));
            return (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={rows}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: '工号', dataIndex: 'employeeNo', width: 100, fixed: 'left' as const },
                  { title: '姓名', dataIndex: 'name', width: 100, fixed: 'left' as const },
                  ...methods.map((m) => ({
                    title: METHOD_OPTS.find((o) => o.value === m)?.label ?? m,
                    width: 140,
                    render: (_: any, r: any) => {
                      const found = r.methods.find((x: any) => x.method === m);
                      if (!found || !found.level) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
                      const color =
                        found.level === 'EXPERT'
                          ? 'gold'
                          : found.level === 'SENIOR'
                            ? 'processing'
                            : found.level === 'JUNIOR'
                              ? 'success'
                              : 'default';
                      return <Tag color={color}>{found.level}</Tag>;
                    },
                  })),
                ]}
              />
            );
          })()
        )}
      </Modal>
    </div>
  );
}