# Backend Development Rules

## Essential Rules

These rules are mandatory and apply across the entire backend codebase.

### Typed Functions

All methods and functions must define parameter types and return types.

* No implicit `any`.

### Environment Variables

Every environment variable must be defined in `.env` and documented in `.env.example`.

* Never commit real secrets.

### Imports

Group imports alphabetically:

1. Internal imports using path aliases.
2. External packages.

Avoid deep relative imports.

### Formatting and Linting

Run before committing:

```bash
npm run format
npm run lint
```

### Error Handling

Handle errors at the appropriate layer.

* Use NestJS HTTP exceptions.
* Return clear, user-friendly messages.
* Do not expose stack traces, SQL, or internal details.

---

# Controllers

Controllers handle HTTP requests and delegate operations to services.

### Rules

* Keep controllers thin.
* Use DTOs for request input.
* Do not contain business logic.
* Do not access repositories directly when a service handles the operation.
* Use appropriate HTTP methods and status codes.
* Use pipes such as `ParseIntPipe` for typed route parameters.

---

# Services

Services contain business logic and application orchestration.

### Rules

* Keep methods focused.
* Handle cross-entity and business rules here.
* Access repositories through dependency injection.
* Use services from other modules through their exported providers.
* Throw appropriate exceptions for business/application errors.

---

# DTOs

DTOs define and validate API input.

### Rules

* Use `class-validator` for validation.
* Use `class-transformer` when type transformation is required.
* Use `CreateXDto`, `UpdateXDto`, etc.
* Do not use entities directly as HTTP input types.
* Use `PartialType` for updates when appropriate.

---

# Entities

Entities represent the persistence model.

### Rules

* Keep entities within their feature/domain.
* Define database fields and relationships explicitly.
* Do not place application or HTTP business logic in entities.

---

# Modules

Organize the backend by feature/domain.

### Rules

* One feature domain should have one module.
* Keep controllers, services, DTOs, and entities together by feature.
* Export services only when another module requires them.
* `AppModule` should compose feature modules and global infrastructure, not contain business logic.

---

# Routes

Routes must remain simple and RESTful.

### Rules

* Every route must map to a controller handler.
* Use named and descriptive RESTful paths.
* Avoid verbs in paths.

Good:

```text
/projects
/projects/:id
```

Avoid:

```text
/getProject
/createProject
```

Use appropriate HTTP methods:

```text
GET     → Read
POST    → Create
PATCH   → Update
DELETE  → Delete
```

---

# Interfaces and Types

Interfaces and types define shared data contracts.

### Rules

* Use PascalCase with the `Interface` suffix when using interfaces.
* Keep major entity contracts in separate files.
* Use `camelCase` properties.
* Represent relations through IDs or typed arrays.
* Avoid unnecessary circular dependencies.

---

# File Organization

Organize code by feature.

```text
src/
├── auth/
├── users/
├── projects/
└── app.module.ts
```

A feature should contain its related controllers, services, DTOs, and entities.

---

# Naming

| Kind                | Convention                 |
| ------------------- | -------------------------- |
| Classes             | `PascalCase`               |
| Methods / variables | `camelCase`                |
| Constants           | `UPPER_SNAKE_CASE`         |
| Controllers         | `PascalCaseController`     |
| Services            | `PascalCaseService`        |
| DTOs                | `CreateXDto`, `UpdateXDto` |
| Entities            | `PascalCase`               |
| Files               | NestJS conventional naming |

```
```
