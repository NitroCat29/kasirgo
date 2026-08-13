import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "solid-app",
		identifier: "solidapp.electrobun.dev",
		version: "0.0.1",
	},
	build: {
		copy: {
			"../frontend/dist/index.html": "views/mainview/index.html",
			"../frontend/dist/assets": "views/mainview/assets",
			"../frontend/dist/kasir.wasm": "views/mainview/assets/kasir.wasm",
		},
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
