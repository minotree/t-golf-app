import test from 'node:test';
import assert from 'node:assert/strict';
import { authErrorMessage } from '../src/auth/authErrorMessage.ts';

test('자격 증명 오류는 가입 여부를 단정하지 않고 가입 안내', () => {
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /이메일 또는 비밀번호/);
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /회원가입/);
});
test('미확인 이메일과 전송 설정·한도를 구분', () => {
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /확인 링크/);
  assert.match(authErrorMessage({ code: 'email_address_not_authorized' }), /발송 설정/);
  assert.match(authErrorMessage({ code: 'over_email_send_rate_limit' }), /전송 한도/);
});
test('서버 원문·알 수 없는 코드·개인정보를 화면에 그대로 노출하지 않음', () => {
  for (const value of [null, undefined, 'private', { code: 'private', message: 'private' }, new Error('private')]) assert.equal(authErrorMessage(value).includes('private'), false);
});
test('네트워크·시간 초과와 비밀번호 정책 구분', () => {
  assert.match(authErrorMessage({ name: 'AuthRetryableFetchError' }), /연결하지 못했습니다/);
  assert.match(authErrorMessage({ code: 'request_timeout' }), /시간이 초과/);
  assert.match(authErrorMessage({ code: 'weak_password' }), /보안 기준/);
});
