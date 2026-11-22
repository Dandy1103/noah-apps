import assert from 'node:assert/strict';
import test from 'node:test';
import { checkNav, checkSystem, checkSystems } from './rules.mjs';

const system = {
  name: '公告',
  repo: 'noah-notice',
  url: '',
  audience: '尚未開放',
  online: false,
};

test('接受一份系統清單', () => {
  assert.equal(checkSystems([system]), '');
});

test('拒絕重複的倉庫名稱', () => {
  assert.equal(checkSystems([system, { ...system }]), '倉庫名稱重複。');
});

test('拒絕帶帳號的網址', () => {
  assert.equal(checkSystem({ ...system, url: 'https://user:secret@example.com/' }), '網址要是 http 或 https，而且不能帶帳號密碼。');
});

test('接受有路徑的導覽', () => {
  const groups = [{
    label: '人資管理',
    app: 'noah-hrm',
    sections: [{
      title: '人員',
      links: [{ label: '員工資料', app: 'noah-hrm', path: 'employees' }],
    }],
  }];
  assert.equal(checkNav(groups, new Set(['noah-hrm'])), '');
});

test('拒絕往上跳的路徑', () => {
  const groups = [{
    label: '人資管理',
    app: 'noah-hrm',
    sections: [{
      title: '人員',
      links: [{ label: '員工資料', app: 'noah-hrm', path: '../employees' }],
    }],
  }];
  assert.equal(checkNav(groups, new Set(['noah-hrm'])), '路徑只能用小寫、數字和斜線。');
});

test('拒絕沒有屬於系統的群組', () => {
  const groups = [{
    label: '公告',
    app: '',
    sections: [{ title: '公告', links: [] }],
  }];
  assert.equal(checkNav(groups, new Set(['noah-notice'])), '每個群組都要屬於一個系統。');
});

test('拒絕兩個群組屬於同一個系統', () => {
  const groups = [
    { label: '公告', app: 'noah-notice', sections: [{ title: '公告', links: [] }] },
    { label: '公告二', app: 'noah-notice', sections: [{ title: '列表', links: [] }] },
  ];
  assert.equal(checkNav(groups, new Set(['noah-notice'])), '同一個系統不能有兩個群組。');
});

test('拒絕指到清單裡沒有的系統', () => {
  const groups = [{
    label: '公告',
    app: 'noah-notice',
    sections: [{ title: '公告', links: [] }],
  }];
  assert.equal(checkNav(groups, new Set()), '群組指到不存在的系統。');
});
