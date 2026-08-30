import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ method?: string; url?: string }>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object' && 'message' in raw
          ? Array.isArray((raw as { message: unknown }).message)
            ? ((raw as { message: string[] }).message.join('; '))
            : String((raw as { message: unknown }).message)
          : exception instanceof Error
            ? exception.message
            : 'Internal server error';

    const code = status === 400 ? 'BAD_REQUEST' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR';
    this.logger.error(`${request.method} ${request.url} -> ${status} ${message}`);

    response.status(status).json({
      success: false,
      data: null,
      message,
      code,
    });
  }
}
