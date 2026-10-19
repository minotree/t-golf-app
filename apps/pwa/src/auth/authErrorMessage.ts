/** 서버 원문에 포함될 수 있는 계정 정보 대신 알려진 오류 코드만 해석한다. */
export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : '';
  const name = typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string' ? error.name : '';
  switch (code) {
    case 'invalid_credentials': return '이메일 또는 비밀번호가 맞지 않습니다. 처음 이용한다면 회원가입 후 이메일 확인을 완료해 주세요.';
    case 'email_not_confirmed': return '가입 확인이 필요합니다. 이메일의 확인 링크를 연 뒤 다시 로그인해 주세요.';
    case 'email_provider_disabled': return '이메일 로그인이 비활성화되어 있습니다. 서비스 인증 설정을 확인해 주세요.';
    case 'signup_disabled': return '현재 신규 가입이 비활성화되어 있습니다. 서비스 가입 설정을 확인해 주세요.';
    case 'over_email_send_rate_limit': return '이메일 전송 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.';
    case 'over_request_rate_limit': return '요청이 너무 많습니다. 잠시 기다린 뒤 다시 시도해 주세요.';
    case 'email_address_not_authorized': return '현재 이메일 발송 설정으로는 이 주소에 메일을 보낼 수 없습니다. 서비스의 이메일 발송 설정을 확인해 주세요.';
    case 'weak_password': return '비밀번호가 보안 기준에 맞지 않습니다. 더 길고 강한 비밀번호를 사용해 주세요.';
    case 'same_password': return '기존 비밀번호와 다른 새 비밀번호를 입력해 주세요.';
    case 'otp_expired': return '이메일 확인 또는 복구 링크가 만료되었습니다. 새 링크를 요청해 주세요.';
    case 'request_timeout': return '인증 요청 시간이 초과되었습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.';
  }
  if (name === 'AbortError' || name === 'AuthRetryableFetchError' || name === 'TypeError') return '인증 서버에 연결하지 못했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.';
  return '인증 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 서비스 인증 설정을 확인해 주세요.';
}
