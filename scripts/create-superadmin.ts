import "dotenv/config";

import { Role } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";
import { env } from "../src/lib/env";
import { prisma } from "../src/lib/prisma/client";

async function main() {
  const phone = env.SUPERADMIN_PHONE;
  const password = process.env.SUPERADMIN_INIT_PASSWORD;

  if (!password) {
    throw new Error("请通过环境变量 SUPERADMIN_INIT_PASSWORD 提供初始密码。");
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      password: hashedPassword,
      role: Role.SUPERADMIN,
      name: "平台超级管理员",
      mustChangePassword: false,
    },
    create: {
      phone,
      password: hashedPassword,
      role: Role.SUPERADMIN,
      name: "平台超级管理员",
      mustChangePassword: false,
    },
  });

  console.log(`SUPERADMIN 创建成功，手机号：${user.phone}，用户ID：${user.id}`);
}

main()
  .catch((error) => {
    console.error("SUPERADMIN 创建失败", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
