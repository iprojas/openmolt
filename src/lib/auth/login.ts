export function googleLogin(callbackUrl: string) {
  return `/api/auth/google?${new URLSearchParams({ callbackUrl })}`;
}

export function welcomePath(homeSearch: string) {
  return homeSearch
    ? `/welcome?${new URLSearchParams({ callbackUrl: `/${homeSearch}` })}`
    : '/welcome';
}
