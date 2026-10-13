import { SetMetadata } from '@nestjs/common';

export const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';
export const REQUIRE_CSRF_KEY = 'requireCsrf';
export const RequireCsrf = () => SetMetadata(REQUIRE_CSRF_KEY, true);
