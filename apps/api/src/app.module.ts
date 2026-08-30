import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { PrismaModule } from './common/prisma.module';
import { RedisModule } from './config/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { DiagnosisModule } from './modules/diagnosis/diagnosis.module';
import { HealthModule } from './modules/health/health.module';
import { ProductsModule } from './modules/products/products.module';
import { ProductionModule } from './modules/production/production.module';
import { RulesModule } from './modules/rules/rules.module';
import { ShopsModule } from './modules/shops/shops.module';
import { UsersModule } from './modules/users/users.module';
import { MicModule } from './modules/mic/mic.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ShopsModule,
    ProductsModule,
    DiagnosisModule,
    RulesModule,
    MicModule,
    ProductionModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
