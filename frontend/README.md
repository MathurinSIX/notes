# FastAPI Project - Frontend

The frontend is built with [Vite](https://vitejs.dev/), [React](https://react.dev/), [TanStack Router](https://tanstack.com/router) (file-based routes under `src/routes`), [TanStack Query](https://tanstack.com/query), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), and [Radix UI](https://www.radix-ui.com/).

## Frontend development

Before you begin, ensure that you have either the Node Version Manager (nvm) or Fast Node Manager (fnm) installed on your system.

-   To install fnm follow the [official fnm guide](https://github.com/Schniz/fnm#installation). If you prefer nvm, you can install it using the [official nvm guide](https://github.com/nvm-sh/nvm#installing-and-updating).

-   After installing either nvm or fnm, proceed to the `frontend` directory:

```bash
cd frontend
```

-   If the Node.js version specified in the `.nvmrc` file isn't installed on your system, you can install it using the appropriate command:

```bash
# If using fnm
fnm install

# If using nvm
nvm install
```

-   Once the installation is complete, switch to the installed version:

```bash
# If using fnm
fnm use

# If using nvm
nvm use
```

-   Within the `frontend` directory, install the necessary NPM packages:

```bash
npm install
```

-   And start the live server with the following `npm` script:

```bash
npm run dev
```

-   Then open your browser at http://localhost:3000/.

Notice that this live server is not running inside Docker, it's for local development, and that is the recommended workflow. Once you are happy with your frontend, you can build the frontend Docker image and start it, to test it in a production-like environment. But building the image at every change will not be as productive as running the local development server with live reload.

Check the file `package.json` to see other available options.

### Removing the frontend

If you are developing an API-only app and want to remove the frontend, you can do it easily:

-   Remove the `./frontend` directory.

-   In the `docker-compose.yml` file, remove the whole service / section `frontend`.

Done, you have a frontend-less (api-only) app. 🤓

---

If you want, you can also remove the `FRONTEND` environment variables from:

-   `.env.development` (repo root; used by Docker Compose for local stack)
-   `./scripts/*.sh`

But it would be only to clean them up, leaving them won't really have any effect either way.

## Generate Client

### Automatically

-   Activate the backend virtual environment.
-   From the top level project directory, run the script:

```bash
./scripts/generate-client.sh
```

You may need to make the file executable:

```bash
chmod +x generate-client.sh
```

-   Commit the changes.

### Manually

-   Start the Docker Compose stack.

-   Download the OpenAPI JSON file from `http://localhost/openapi.json` and copy it to a new file `openapi.json` at the root of the `frontend` directory.

-   To simplify the names in the generated frontend client code, modify the `openapi.json` file by running the following script:

```bash
node modify-openapi-operationids.mjs
```

-   To generate the frontend client, run:

```bash
npm run generate-client
```

-   Commit the changes.

Notice that everytime the backend changes (changing the OpenAPI schema), you should follow these steps again to update the frontend client.

## Code Structure

The frontend code is structured as follows:

-   `frontend/src` - The main frontend code.
-   `frontend/src/routes` - File-based routes (TanStack Router; Next.js–style `index`, `login`, `__root`).
-   `frontend/src/pages` - Page UI used by route files.
-   `frontend/public` - Static files served at the site root (for example favicons).
-   `frontend/src/client` - The generated OpenAPI client.
-   `frontend/src/components` - Shared UI and layout components.
-   `frontend/src/hooks` - Custom hooks.

## End-to-End Testing with Playwright

The frontend includes initial end-to-end tests using Playwright. To run the tests, you need to have the Docker Compose stack running. Start the stack with the following command:

```bash
docker compose --env-file .env.development -f docker-compose.yml up -d --wait backend
```

Then, you can run the tests with the following command:

```bash
npx playwright test
```

You can also run your tests in UI mode to see the browser and interact with it running:

```bash
npx playwright test --ui
```

To stop and remove the Docker Compose stack and clean the data created in tests, use the following command:

```bash
docker compose --env-file .env.development -f docker-compose.yml down -v
```

To update the tests, navigate to the tests directory and modify the existing test files or add new ones as needed.

For more information on writing and running Playwright tests, refer to the official [Playwright documentation](https://playwright.dev/docs/intro).
