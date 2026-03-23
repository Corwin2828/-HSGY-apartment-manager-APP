import { NextRequest, NextResponse } from "next/server";

import { canAccessPath, getHomePathByRole } from "@/lib/auth/guards";
import { readSessionFromRequest } from "@/lib/auth/session";
import { PUBLIC_PATH_PREFIXES, RATE_LIMIT_SCENES } from "@/lib/constants";
import { env } from "@/lib/env";
import { errorResponse } from "@/lib/response";
import { buildRateLimitKey } from "@/lib/rate-limit/key";
import { checkRateLimit } from "@/lib/rate-limit/store";
import { middlewareMatcher } from "@/middleware/matchers";

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function checkAuthRateLimit(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/api/auth/login") {
    return checkRateLimit({
      key: buildRateLimitKey(RATE_LIMIT_SCENES.LOGIN, request),
      max: env.RATE_LIMIT_LOGIN_MAX,
      windowSec: env.RATE_LIMIT_LOGIN_WINDOW_SEC,
    });
  }

  if (pathname === "/api/auth/sms-code") {
    return checkRateLimit({
      key: buildRateLimitKey(RATE_LIMIT_SCENES.SMS, request),
      max: env.RATE_LIMIT_SMS_MAX,
      windowSec: env.RATE_LIMIT_SMS_WINDOW_SEC,
    });
  }

  if (pathname === "/api/auth/captcha") {
    return checkRateLimit({
      key: buildRateLimitKey(RATE_LIMIT_SCENES.CAPTCHA, request),
      max: env.RATE_LIMIT_CAPTCHA_MAX,
      windowSec: env.RATE_LIMIT_CAPTCHA_WINDOW_SEC,
    });
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = readSessionFromRequest(request);
  const limitResult = await checkAuthRateLimit(request);

  if (limitResult && !limitResult.allowed) {
    if (pathname.startsWith("/api/")) {
      return errorResponse("请求过于频繁，请稍后再试", {
        status: 429,
        code: "RATE_LIMITED",
        headers: {
          "Retry-After": String(limitResult.retryAfterSec ?? 60),
        },
      });
    }

    return NextResponse.redirect(new URL("/login?error=rate_limited", request.url));
  }

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && session) {
      return NextResponse.redirect(
        new URL(session.forcePasswordChange ? "/first-login" : getHomePathByRole(session.role), request.url),
      );
    }

    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return errorResponse("未登录或登录已过期", {
        status: 401,
        code: "UNAUTHORIZED",
      });
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (
    session.forcePasswordChange &&
    !pathname.startsWith("/first-login") &&
    !pathname.startsWith("/api/auth/first-login") &&
    !pathname.startsWith("/api/auth/logout")
  ) {
    return NextResponse.redirect(new URL("/first-login", request.url));
  }

  if (!canAccessPath(pathname, session.role)) {
    if (pathname.startsWith("/api/")) {
      return errorResponse("无权访问该资源", {
        status: 403,
        code: "FORBIDDEN",
      });
    }

    return NextResponse.redirect(new URL(getHomePathByRole(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: middlewareMatcher,
};
