import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Planify API',
      version: '1.0.0',
      description: 'API de gestion de planning pour commerces de detail',
    },
    servers: [
      { url: '/api', description: 'API Server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            stores: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['owner', 'member'] },
                },
              },
            },
            currentStoreId: { type: 'string', nullable: true },
          },
        },
        Employee: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            contractType: { type: 'string', enum: ['CDI', 'CDD', 'Alternant', 'Stage'] },
            weeklyHours: { type: 'number' },
            color: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
        Shift: {
          type: 'object',
          properties: {
            employeeId: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD' },
            startTime: { type: 'string', description: 'HH:mm or CP/AM' },
            endTime: { type: 'string', description: 'HH:mm or CP/AM' },
          },
        },
        Planning: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            storeId: { type: 'string' },
            weekStart: { type: 'string' },
            weekEnd: { type: 'string' },
            shifts: { type: 'array', items: { $ref: '#/components/schemas/Shift' } },
            isValidated: { type: 'boolean' },
            validatedAt: { type: 'string', nullable: true },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
}

export const swaggerSpec = swaggerJsdoc(options)
