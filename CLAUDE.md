# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup
```bash
npm install
```

### Development
```bash
npm run dev                    # Start development server with hot-reload
npm run build                  # Type-check, compile and minify for production
npm run preview               # Preview production build locally
```

### Testing
```bash
npm run test:unit             # Run unit tests with Vitest
npm run test:e2e:dev          # Run e2e tests against dev server (faster)
npm run test:e2e              # Run e2e tests against production build
```

### Code Quality
```bash
npm run lint                  # Lint with ESLint and auto-fix
npm run format                # Format code with Prettier
npm run type-check            # Type-check with Vue TypeScript compiler
```

### Build Process
The build process runs type-checking in parallel with the build using `npm-run-all2`:
```bash
npm run build                 # Equivalent to: run-p type-check "build-only {@}" --
```

## Architecture

### Tech Stack
- **Vue 3** with Composition API and `<script setup>` syntax
- **TypeScript** for type safety
- **Vite** for fast development and building
- **Vue Router** for client-side routing
- **Pinia** for state management
- **Vitest** for unit testing (jsdom environment)
- **Cypress** for e2e testing

### Project Structure
```
src/
├── main.ts              # Application entry point
├── App.vue              # Root component
├── components/          # Reusable components
│   ├── HelloWorld.vue
│   ├── TheWelcome.vue
│   ├── WelcomeItem.vue
│   ├── __tests__/       # Component unit tests
│   └── icons/           # Icon components
├── views/               # Page components
│   ├── HomeView.vue
│   └── AboutView.vue
├── router/              # Vue Router configuration
│   └── index.ts
├── stores/              # Pinia stores
│   └── counter.ts
└── assets/              # Static assets
    ├── base.css
    ├── main.css
    └── logo.svg
```

### Key Patterns
- **Composition API**: Uses `<script setup>` syntax for all components
- **Store Pattern**: Pinia stores use the composition API style with `defineStore`
- **Routing**: Supports lazy-loaded routes (see AboutView)
- **Alias**: `@` alias configured for `./src` directory
- **Testing**: Unit tests use Vue Test Utils with jsdom environment

### Configuration Files
- `vite.config.ts` - Vite configuration with Vue plugins and path aliases
- `vitest.config.ts` - Test configuration extending Vite config
- `cypress.config.ts` - E2E test configuration
- `tsconfig.*.json` - TypeScript configurations for different environments