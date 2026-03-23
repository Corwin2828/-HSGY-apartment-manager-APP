import "dotenv/config";

import { Prisma, RefundStatus, RepairStatus, Role, RoomStatus } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";
import { encryptSensitiveText } from "../src/lib/crypto/aes";
import { prisma } from "../src/lib/prisma/client";

async function upsertUser(input: {
  phone: string;
  password: string;
  role: Role;
  name: string;
  mustChangePassword?: boolean;
}) {
  const hashedPassword = await hashPassword(input.password);

  return prisma.user.upsert({
    where: { phone: input.phone },
    update: {
      password: hashedPassword,
      role: input.role,
      name: input.name,
      mustChangePassword: input.mustChangePassword ?? false,
    },
    create: {
      phone: input.phone,
      password: hashedPassword,
      role: input.role,
      name: input.name,
      mustChangePassword: input.mustChangePassword ?? false,
    },
  });
}

async function main() {
  const landlordUser = await upsertUser({
    phone: "13900000001",
    password: "Landlord123",
    role: Role.LANDLORD,
    name: "演示房东",
  });

  const adminUser = await upsertUser({
    phone: "13900000002",
    password: "Admin12345",
    role: Role.ADMIN,
    name: "演示管理员",
  });

  const tenantUser = await upsertUser({
    phone: "13900000003",
    password: "Tenant123",
    role: Role.TENANT,
    name: "演示租户",
  });

  const superUser = await upsertUser({
    phone: process.env.SUPERADMIN_PHONE ?? "13800138000",
    password: "Super12345",
    role: Role.SUPERADMIN,
    name: "平台超级管理员",
  });

  await prisma.admin.upsert({
    where: { userId: adminUser.id },
    update: {
      permissions: {
        canSetRent: true,
        canEditBasicInfo: true,
        canEditIdCard: false,
      },
    },
    create: {
      userId: adminUser.id,
      permissions: {
        canSetRent: true,
        canEditBasicInfo: true,
        canEditIdCard: false,
      },
    },
  });

  let building = await prisma.building.findFirst({
    where: {
      landlordId: landlordUser.id,
      name: "静安演示公寓",
    },
  });

  if (!building) {
    building = await prisma.building.create({
      data: {
        name: "静安演示公寓",
        address: "上海市静安区演示路 100 号",
        landlordId: landlordUser.id,
      },
    });
  }

  await prisma.adminBuilding.upsert({
    where: {
      adminId_buildingId: {
        adminId: adminUser.id,
        buildingId: building.id,
      },
    },
    update: {},
    create: {
      adminId: adminUser.id,
      buildingId: building.id,
    },
  });

  let room101 = await prisma.room.upsert({
    where: {
      buildingId_roomNumber: {
        buildingId: building.id,
        roomNumber: "101",
      },
    },
    update: {
      status: RoomStatus.OCCUPIED,
      rentPrice: new Prisma.Decimal(2980),
      depositAmount: new Prisma.Decimal(3000),
      waterUnitPrice: new Prisma.Decimal(6.5),
      elecUnitPrice: new Prisma.Decimal(1.2),
    },
    create: {
      buildingId: building.id,
      roomNumber: "101",
      status: RoomStatus.OCCUPIED,
      rentPrice: new Prisma.Decimal(2980),
      depositAmount: new Prisma.Decimal(3000),
      waterUnitPrice: new Prisma.Decimal(6.5),
      elecUnitPrice: new Prisma.Decimal(1.2),
    },
  });

  await prisma.tenant.upsert({
    where: { userId: tenantUser.id },
    update: {
      roomId: room101.id,
      idCard: encryptSensitiveText("310101199901011234"),
      gender: "男",
    },
    create: {
      userId: tenantUser.id,
      roomId: room101.id,
      idCard: encryptSensitiveText("310101199901011234"),
      gender: "男",
    },
  });

  room101 = await prisma.room.update({
    where: { id: room101.id },
    data: {
      tenantId: tenantUser.id,
      checkInDate: new Date("2026-01-01T10:00:00.000Z"),
      expectedCheckOut: new Date("2026-12-31T10:00:00.000Z"),
    },
  });

  const existingCoTenant = await prisma.coTenant.findFirst({
    where: {
      tenantId: tenantUser.id,
      name: "演示同住人",
    },
  });

  if (existingCoTenant) {
    await prisma.coTenant.update({
      where: { id: existingCoTenant.id },
      data: {
        roomId: room101.id,
        gender: "女",
        phone: "13900000004",
        idCard: encryptSensitiveText("310101199902022222"),
      },
    });
  } else {
    await prisma.coTenant.create({
      data: {
        tenantId: tenantUser.id,
        roomId: room101.id,
        name: "演示同住人",
        gender: "女",
        phone: "13900000004",
        idCard: encryptSensitiveText("310101199902022222"),
      },
    });
  }

  const existingWaterRecord = await prisma.waterElecRecord.findFirst({
    where: {
      roomId: room101.id,
      type: "water",
      month: "2026-03",
      createdBy: adminUser.id,
    },
  });

  const waterRecord =
    existingWaterRecord ??
    (await prisma.waterElecRecord.create({
      data: {
        roomId: room101.id,
        type: "water",
        reading: new Prisma.Decimal(123.4),
        amount: new Prisma.Decimal(86),
        month: "2026-03",
        createdBy: adminUser.id,
        photoUrl: "https://example.com/water-101.jpg",
      },
    }));

  const existingElecRecord = await prisma.waterElecRecord.findFirst({
    where: {
      roomId: room101.id,
      type: "elec",
      month: "2026-03",
      createdBy: adminUser.id,
    },
  });

  const elecRecord =
    existingElecRecord ??
    (await prisma.waterElecRecord.create({
      data: {
        roomId: room101.id,
        type: "elec",
        reading: new Prisma.Decimal(341.7),
        amount: new Prisma.Decimal(186),
        month: "2026-03",
        createdBy: adminUser.id,
        photoUrl: "https://example.com/elec-101.jpg",
      },
    }));

  let rentPayment = await prisma.payment.findFirst({
    where: {
      tenantId: tenantUser.id,
      type: "rent",
      month: "2026-03",
    },
  });

  if (!rentPayment) {
    rentPayment = await prisma.payment.create({
      data: {
        tenantId: tenantUser.id,
        type: "rent",
        amount: new Prisma.Decimal(2980),
        month: "2026-03",
        status: "UNPAID",
        payMethod: null,
      },
    });
  }

  let waterPayment = await prisma.payment.findFirst({
    where: {
      transactionId: "PM-DEMO-WATER-202603",
    },
  });

  if (!waterPayment) {
    waterPayment = await prisma.payment.create({
      data: {
        tenantId: tenantUser.id,
        type: "water",
        amount: new Prisma.Decimal(86),
        month: "2026-03",
        status: "PAID",
        payMethod: "WECHAT_H5",
        transactionId: "PM-DEMO-WATER-202603",
        paidAt: new Date("2026-03-03T10:00:00.000Z"),
      },
    });
  }

  let elecPayment = await prisma.payment.findFirst({
    where: {
      transactionId: "PM-DEMO-ELEC-202603",
    },
  });

  if (!elecPayment) {
    elecPayment = await prisma.payment.create({
      data: {
        tenantId: tenantUser.id,
        type: "elec",
        amount: new Prisma.Decimal(186),
        month: "2026-03",
        status: "PENDING",
        payMethod: "ALIPAY_H5",
        transactionId: "PM-DEMO-ELEC-202603",
      },
    });
  }

  let depositRecord = await prisma.depositRecord.findFirst({
    where: {
      transactionId: "DP-DEMO-202601",
    },
  });

  if (!depositRecord) {
    depositRecord = await prisma.depositRecord.create({
      data: {
        roomId: room101.id,
        tenantId: tenantUser.id,
        amount: new Prisma.Decimal(3000),
        status: "paid",
        payMethod: "WECHAT_H5",
        transactionId: "DP-DEMO-202601",
        paidAt: new Date("2026-01-01T10:30:00.000Z"),
      },
    });
  }

  const refundRequest = await prisma.depositRefundRequest.upsert({
    where: {
      depositRecordId: depositRecord.id,
    },
    update: {
      roomId: room101.id,
      tenantId: tenantUser.id,
      reason: "工作调动，申请按流程退租退押",
      expectedCheckOut: new Date("2026-04-01T10:00:00.000Z"),
      status: RefundStatus.APPROVED,
      approverId: landlordUser.id,
      approvedAt: new Date("2026-03-22T10:00:00.000Z"),
    },
    create: {
      roomId: room101.id,
      tenantId: tenantUser.id,
      depositRecordId: depositRecord.id,
      reason: "工作调动，申请按流程退租退押",
      expectedCheckOut: new Date("2026-04-01T10:00:00.000Z"),
      photos: ["https://example.com/refund-room-101.jpg"],
      status: RefundStatus.APPROVED,
      approverId: landlordUser.id,
      approvedAt: new Date("2026-03-22T10:00:00.000Z"),
    },
  });

  await prisma.refundOrder.upsert({
    where: {
      refundRequestId: refundRequest.id,
    },
    update: {
      amount: new Prisma.Decimal(2800),
      transactionId: `RF-DEMO-${refundRequest.id}`,
      status: "PROCESSING",
    },
    create: {
      refundRequestId: refundRequest.id,
      amount: new Prisma.Decimal(2800),
      transactionId: `RF-DEMO-${refundRequest.id}`,
      status: "PROCESSING",
    },
  });

  const existingRepair = await prisma.repair.findFirst({
    where: {
      roomId: room101.id,
      tenantId: tenantUser.id,
      description: "卫生间花洒漏水，需要上门处理",
    },
  });

  if (!existingRepair) {
    await prisma.repair.create({
      data: {
        roomId: room101.id,
        tenantId: tenantUser.id,
        description: "卫生间花洒漏水，需要上门处理",
        photos: ["https://example.com/repair-before.jpg"],
        status: RepairStatus.PROCESSING,
        handlerId: adminUser.id,
      },
    });
  }

  const existingContract = await prisma.contract.findFirst({
    where: {
      tencentFlowId: `FLOW-DEMO-${room101.id}`,
    },
  });

  if (!existingContract) {
    await prisma.contract.create({
      data: {
        buildingId: building.id,
        roomId: room101.id,
        tenantId: tenantUser.id,
        tencentFlowId: `FLOW-DEMO-${room101.id}`,
        status: "draft",
        pdfUrl: "https://example.com/contracts/demo-room-101.pdf",
      },
    });
  }

  const existingSeedLog = await prisma.operationLog.findFirst({
    where: {
      userId: superUser.id,
      action: "SEED_COMPLETED",
      targetId: building.id,
    },
  });

  if (!existingSeedLog) {
    await prisma.operationLog.createMany({
      data: [
        {
          userId: landlordUser.id,
          action: "SEED_CREATED_BUILDING",
          targetId: building.id,
          details: { buildingName: building.name },
        },
        {
          userId: adminUser.id,
          action: "SEED_CREATED_METER_RECORDS",
          targetId: waterRecord.id,
          details: { waterRecordId: waterRecord.id, elecRecordId: elecRecord.id },
        },
        {
          userId: tenantUser.id,
          action: "SEED_CREATED_PAYMENTS",
          targetId: rentPayment.id,
          details: { rentPaymentId: rentPayment.id, waterPaymentId: waterPayment.id, elecPaymentId: elecPayment.id },
        },
        {
          userId: superUser.id,
          action: "SEED_COMPLETED",
          targetId: building.id,
          details: { landlordUserId: landlordUser.id, adminUserId: adminUser.id, tenantUserId: tenantUser.id },
        },
      ],
    });
  }

  console.log("Seed 完成：已创建演示房东、管理员、租户、楼栋、房间、账单、退押、报修和合同数据。");
}

main()
  .catch((error) => {
    console.error("Seed 失败", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
