import path from "node:path"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { THEME_COLOR_DARK } from "./src/lib/themeChrome"

export default defineConfig({
	plugins: [
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
		VitePWA({
			disable: process.env.VITE_README_SCREENSHOTS === "1",
			registerType: "autoUpdate",
			includeAssets: [
				"favicon.svg",
				"apple-touch-icon.png",
				"pwa-192x192.png",
				"pwa-512x512.png",
				"pwa-maskable-512x512.png",
			],
			manifest: {
				name: "Notes",
				short_name: "Notes",
				description: "Capture and organize your notes",
				theme_color: THEME_COLOR_DARK,
				background_color: THEME_COLOR_DARK,
				display: "standalone",
				scope: "/",
				start_url: "/",
				icons: [
					{
						src: "pwa-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "pwa-maskable-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
				navigateFallback: "/index.html",
			},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		host: true,
		port: 3000,
	},
	preview: {
		host: true,
		port: 3000,
	},
})
