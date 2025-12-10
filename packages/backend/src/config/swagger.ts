import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Market Security API',
      version: '1.0.0',
      description: 'API para sistema de prevenção e inteligência contra furtos em mercado',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiTokenAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API Token for external integrations (n8n, etc). Use: Authorization: Bearer YOUR_API_TOKEN',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);