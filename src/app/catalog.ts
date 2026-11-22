export interface ManagedApp {
  name: string;
  repo: string;
  url: string;
  audience: string;
  online: boolean;
}

export const MANAGED_APPS: ManagedApp[] = [
  { name: '入口', repo: 'noah-portal', url: 'https://noahportal.dandy-cheng.com/', audience: '全員', online: true },
  { name: '人資管理', repo: 'noah-hrm', url: 'https://noahhrm.dandy-cheng.com/', audience: '人資', online: true },
  { name: '公告', repo: 'noah-notice', url: '', audience: '尚未開放', online: false },
  { name: '通知', repo: 'noah-notify', url: '', audience: '尚未開放', online: false },
  { name: '文件', repo: 'noah-docs', url: '', audience: '尚未開放', online: false },
  { name: '行事曆', repo: 'noah-calendar', url: '', audience: '尚未開放', online: false },
  { name: '帳號管理', repo: 'noah-account', url: '', audience: '尚未開放', online: false },
  { name: '應用管理', repo: 'noah-apps', url: '', audience: '系統管理員', online: false },
  { name: '客戶關係', repo: 'noah-crm', url: '', audience: '尚未開放', online: false },
  { name: '財務會計', repo: 'noah-erp', url: '', audience: '尚未開放', online: false },
  { name: '資訊服務', repo: 'noah-itsm', url: '', audience: '尚未開放', online: false },
  { name: '教育訓練', repo: 'noah-lms', url: '', audience: '尚未開放', online: false },
  { name: '簽核', repo: 'noah-approval', url: '', audience: '尚未開放', online: false },
  { name: '總務行政', repo: 'noah-affairs', url: '', audience: '尚未開放', online: false },
  { name: '薪資', repo: 'noah-payroll', url: '', audience: '尚未開放', online: false },
  { name: '專案管理', repo: 'noah-project', url: '', audience: '尚未開放', online: false },
];
