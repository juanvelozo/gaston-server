import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorType = 'Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null) {
        const r = response as { message?: string | string[]; error?: string };

        message = r.message ?? message;
        errorType = r.error ?? errorType;
      } else if (typeof response === 'string') {
        message = response;
      }
    }

    res.status(status).json({
      statusCode: status,
      message,
      error: errorType,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
