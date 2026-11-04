import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = new Set(
    [process.env.FRONTEND_URL, 'http://localhost:3000'].filter(
      (origin): origin is string => Boolean(origin),
    ),
  );

  app.enableCors({
    origin: isProduction
      ? (
          origin: string | undefined,
          callback: (error: Error | null, allow?: boolean) => void,
        ) => {
          if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
          }

          callback(new Error(`Origin ${origin} is not allowed by CORS`));
        }
      : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
    preflightContinue: false,
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS' && !isProduction) {
      const origin = req.headers.origin;

      if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
        res.header(
          'Access-Control-Allow-Methods',
          'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        );
        res.header(
          'Access-Control-Allow-Headers',
          'Content-Type,Authorization',
        );
        res.header('Access-Control-Allow-Credentials', 'true');
        res.sendStatus(204);
        return;
      }
    }

    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
