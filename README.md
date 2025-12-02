# pme-poc

learning! This is a v0.1 PWA in Vue (new to me language) leveraging Google services (which I found better than OpenStreetMaps) and the NOAA API to pull geo-accurate weather conditions to plug into the [Penman-Monteith equation](https://www.fao.org/4/x0490e/x0490e06.htm) to calculate evapotranspiration of a plant to support farmers.

Things I learned with the POC:
* I still suck at UI and UX. Some things never change.
* Claude Code in VS Code is quite impressive - using coding agent runtime context to e.g. rebuild the geocodingService on the fly to move from OpenStreetMaps to GooglePlaces while I worked on wrestling with UX workflow stuff WORKED.
* Prompt authoring (and understanding context) is king. I spent something like 4 hours on the initial POC and got to a working prototype. At first, I chipped away at things with tiny prompts. By the end of the 4 hours, a well structured prompt could accomplish much cleaner and more comprehensive outcomes in a fraction of the time.
* I don’t actually need to become familiar with my service dependencies, though it helps. Claude makes poor choices sometimes. Developing familiarity helped me be more pointed with my instructions which resulted in faster, more accurate results. I was able to begin the shift from hacking to orchestrating and building. In hours. You are way smarter than me, just imagine what you could do.
* I still suck at UI and UX.

But, I have a basic prototype of a Vue 3 app that is 2/3rds of the way there. And I learned a bit about Vue application architecture, PWAs (will they ever really matter?), Claude Code, the complex landscape of Google mapping services, and more. Most importantly I reinforced that learning how things works pays off - big time.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).


## Customize configuration

Geolocation and or address searches use Google Maps APIs. Pass your API key enabled for all Google Maps APIs in a .env file in the root folder of the repository.

Contents:
```VITE_GOOGLE_MAPS_API_KEY=yourAPIkey```

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Run End-to-End Tests with [Cypress](https://www.cypress.io/)

```sh
npm run test:e2e:dev
```

This runs the end-to-end tests against the Vite development server.
It is much faster than the production build.

But it's still recommended to test the production build with `test:e2e` before deploying (e.g. in CI environments):

```sh
npm run build
npm run test:e2e
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
