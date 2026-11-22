export const systems = [
  ['入口', 'noah-portal', 'https://noahportal.dandy-cheng.com/', '全員', true],
  ['人資管理', 'noah-hrm', 'https://noahhrm.dandy-cheng.com/', '人資', true],
  ['公告', 'noah-notice', '', '尚未開放', false],
  ['通知', 'noah-notify', '', '尚未開放', false],
  ['文件', 'noah-docs', '', '尚未開放', false],
  ['行事曆', 'noah-calendar', '', '尚未開放', false],
  ['帳號管理', 'noah-account', '', '尚未開放', false],
  ['應用管理', 'noah-apps', '', '系統管理員', false],
  ['客戶關係', 'noah-crm', '', '尚未開放', false],
  ['財務會計', 'noah-erp', '', '尚未開放', false],
  ['資訊服務', 'noah-itsm', '', '尚未開放', false],
  ['教育訓練', 'noah-lms', '', '尚未開放', false],
  ['簽核', 'noah-approval', '', '尚未開放', false],
  ['總務行政', 'noah-affairs', '', '尚未開放', false],
  ['薪資', 'noah-payroll', '', '尚未開放', false],
  ['專案管理', 'noah-project', '', '尚未開放', false],
];

function link(label, app, path = '') {
  return { label, app, path };
}

function section(title, links) {
  return { title, links };
}

function group(label, app, sections) {
  return { label, app, sections };
}

const home = (app, labels) => labels.map((label) => link(label, app));

export const groups = [
  group('公告', 'noah-notice', [
    section('公告', home('noah-notice', ['公告列表', '發布公告'])),
  ]),
  group('通知', 'noah-notify', [
    section('通知', home('noah-notify', ['我的通知', '發送通知'])),
  ]),
  group('文件', 'noah-docs', [
    section('文件', home('noah-docs', ['文件庫', '分類'])),
  ]),
  group('行事曆', 'noah-calendar', [
    section('行事曆', home('noah-calendar', ['公司行事曆', '活動'])),
  ]),
  group('帳號管理', 'noah-account', [
    section('帳號', home('noah-account', ['帳號列表', '帳號申請'])),
    section('權限', home('noah-account', ['權限設定'])),
  ]),
  group('應用管理', 'noah-apps', [
    section('應用', [
      link('系統清單', 'noah-apps', 'systems'),
      link('導覽', 'noah-apps', 'navigation'),
    ]),
  ]),
  group('人資管理', 'noah-hrm', [
    section('人員', [
      link('員工資料', 'noah-hrm', 'employees'),
      link('組織', 'noah-hrm', 'organization'),
    ]),
    section('出勤', [
      link('出勤紀錄', 'noah-hrm', 'attendance'),
      link('加班', 'noah-hrm', 'overtime'),
    ]),
    section('假勤', [
      link('請假', 'noah-hrm', 'leave'),
      link('出差', 'noah-hrm', 'trip'),
    ]),
  ]),
  group('客戶關係', 'noah-crm', [
    section('客戶', home('noah-crm', ['客戶資料', '聯絡人'])),
    section('銷售', home('noah-crm', ['商機', '報價', '合約'])),
  ]),
  group('財務會計', 'noah-erp', [
    section('請款', home('noah-erp', ['費用報銷', '付款'])),
    section('採購', home('noah-erp', ['採購單', '供應商'])),
    section('庫存', home('noah-erp', ['庫存查詢'])),
  ]),
  group('資訊服務', 'noah-itsm', [
    section('服務', home('noah-itsm', ['報修', '需求單'])),
  ]),
  group('教育訓練', 'noah-lms', [
    section('課程', home('noah-lms', ['課程目錄', '我的課程'])),
    section('報名', home('noah-lms', ['開課報名', '學習紀錄'])),
  ]),
  group('簽核', 'noah-approval', [
    section('流程', home('noah-approval', ['待我簽核', '我送出的', '表單'])),
  ]),
  group('總務行政', 'noah-affairs', [
    section('場地', home('noah-affairs', ['會議室', '訪客'])),
    section('庶務', home('noah-affairs', ['備品', '公務車', '修繕'])),
  ]),
  group('薪資', 'noah-payroll', [
    section('薪資', home('noah-payroll', ['薪資單', '投保'])),
    section('稅務', home('noah-payroll', ['所得扣繳'])),
  ]),
  group('專案管理', 'noah-project', [
    section('案子', home('noah-project', ['專案', '成員', '進度'])),
    section('工時', home('noah-project', ['工時填報'])),
  ]),
];
