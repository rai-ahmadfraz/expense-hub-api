import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      accelerateUrl: "prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19CNWdRQm5Cb0diU1lHeUhPVnRLSXQiLCJhcGlfa2V5IjoiMDFLQjYyMFA2TTVDMEg0VzhKS00ySzFLNEIiLCJ0ZW5hbnRfaWQiOiJhMGIwYWQ3Y2RhNzA5NjUyNzMwMjkwMmYzMzhkOGQxMTM2N2JkZjM0YTJhOGEyMjE2MDFiNGQxOTQ0ZDMxYTFmIiwiaW50ZXJuYWxfc2VjcmV0IjoiNjEzMTY2OGUtMzVmZS00MTk3LWIwODYtNjIwZjg0ZTg1MWU2In0.pbWlcSKIc1hqrmGDxyHFTNq0wlfiWGosiePEz49xojs",
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('SIGTERM', async () => {
      await app.close();
    });
    process.on('SIGINT', async () => {
      await app.close();
    });
  }
}
