# Overview

The My Love PWA uses a strongly-typed architecture with comprehensive TypeScript interfaces across multiple layers:

- **Application Types** (`src/types/index.ts`) - Core domain models
- **Database Types** (`src/types/database.types.ts`) - Supabase generated types
- **Validation Schemas** (`src/validation/schemas.ts`) - Zod runtime validation
- **API Response Types** (`src/api/validation/supabaseSchemas.ts`) - API contract validation
