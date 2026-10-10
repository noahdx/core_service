# Assistant Instructions

## Communication Style
- Always reply in simple, clear, and easy-to-understand English.
- Do not use complex words, difficult grammar, or idioms.
- Keep sentences short and get straight to the point.
- Provide clean, basic, and direct answers.
- Do not change or edit code unless the user explicitly asks you to.

## Step-by-Step Workflow
Always follow this exact 8-step order from `WORKFLOW` when building a domain:
1. **Create Migrations Database**: Write SQL migrations in `src/migrations` with proper foreign keys, constraints, and indexes.
2. **Create Entity**: Define domain entity class in `src/app/<domain>/entity/` with typed properties and a `constructor(data: Partial<Entity>)`.
3. **Implement Repository**: Create repository in `src/app/<domain>/repository/`. Use `tsyringe` `@injectable()`, explicit `COLUMNS` list, and `toEntity()` mapping.
4. **Create DTO**: Create request validation DTOs in `src/app/<domain>/dto/` using `class-validator` decorators.
5. **Implement Service**: Create service in `src/app/<domain>/service/`. Handle business rules and permissions. Return structured `{ message, data }` objects.
6. **Implement Controller**: Create controller in `src/app/<domain>/controller/`. Always use arrow functions for handler methods to preserve `this` context. Use `validateBody()` for input validation.
7. **Implement Route & DI**:
   - Register repository, service, and controller in `src/lib/di/tokens.ts` and `src/lib/di/container.ts`.
   - Define router in `src/app/<domain>/routes.ts`.
   - Mount router in `src/routes.ts`.
8. **Test Endpoints**: Run migrations and test each endpoint for happy path and error cases.

## Engineering Standards & Code Style
- **Balanced Engineering**:
  - Do not over-engineer: Avoid extra abstractions, wrappers, or unused design patterns.
  - Do not under-engineer: Validate all inputs, handle errors with `AppError`, and enforce RBAC.
- **Maintainability & Clean Architecture**:
  - Keep strict layer separation: `Controller` -> `Service` -> `Repository` -> `Database`.
  - Use dependency injection (`tsyringe`) consistently across all layers.
- **High Performance**:
  - Index foreign keys, search columns, and soft-delete columns.
  - Select only defined `COLUMNS`, never raw unbounded wildcard queries.
  - Use database-level triggers for automatic row synchronization where applicable.
