(function () {
	const APP_STORE_URL = "https://apps.apple.com/us/app/horika/id6746124840";
	const FILM_LAB_PREFIX = "horika://film-lab/";

	console.log("[Init] Initializing preview.js");

	const nameEl = document.getElementById("preset-name");
	const descriptionEl = document.getElementById("preset-description");
	const openInAppEl = document.getElementById("open-in-app");
	const copyLinkEl = document.getElementById("copy-link");
	const statusEl = document.getElementById("status-message");
	const qrCanvas = document.getElementById("qr-canvas");
	const cardShell = document.querySelector(".card-shell");
	let qrCodeInstance = null;

	console.log("[Init] DOM elements loaded:", {
		nameEl: !!nameEl,
		descriptionEl: !!descriptionEl,
		openInAppEl: !!openInAppEl,
		copyLinkEl: !!copyLinkEl,
		statusEl: !!statusEl,
		qrCanvas: !!qrCanvas,
		cardShell: !!cardShell
	});

	function setStatus(text) {
		statusEl.textContent = text;
	}

	function parseHashData() {
		const queryParams = new URLSearchParams(window.location.search);
		const queryData = queryParams.get("data") || "";
		console.log("[parseHashData] Query param data:", queryData ? queryData.substring(0, 30) + "..." : "(empty)");

		if (queryData) {
			console.log("[parseHashData] Using query parameter");
			return queryData;
		}

		const hash = window.location.hash.startsWith("#") ? window.location.hash.substring(1) : "";
		const hashParams = new URLSearchParams(hash);
		const hashData = hashParams.get("data") || "";
		console.log("[parseHashData] Hash param data:", hashData ? hashData.substring(0, 30) + "..." : "(empty)");

		return hashData;
	}

	function parseHashFields() {
		const queryParams = new URLSearchParams(window.location.search);
		const hash = window.location.hash.startsWith("#") ? window.location.hash.substring(1) : "";
		const hashParams = new URLSearchParams(hash);

		const read = (key) => queryParams.get(key) || hashParams.get(key) || "";

		return {
			name: read("name").trim(),
			description: read("description").trim(),
			baseColor: read("base").trim(),
			edgeColor: read("edge").trim()
		};
	}

	function isValidEncodedPayload(encoded) {
		if (!encoded) {
			console.log("[isValidEncodedPayload] Empty payload");
			return false;
		}

		if (encoded.length < 24 || encoded.length > 12000) {
			console.log("[isValidEncodedPayload] Invalid length:", encoded.length);
			return false;
		}

		const isValid = /^[A-Za-z0-9_-]+$/.test(encoded);
		console.log("[isValidEncodedPayload] Character set valid:", isValid);
		return isValid;
	}

	function decodePayloadIfPlainBase64(encoded) {
		try {
			let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
			const pad = (4 - (base64.length % 4)) % 4;
			if (pad > 0) {
				base64 = base64 + "=".repeat(pad);
			}

			const binary = atob(base64);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i += 1) {
				bytes[i] = binary.charCodeAt(i);
			}

			// iOS payload is deflate (zlib)-compressed before encoding, so direct parse usually fails.
			const text = new TextDecoder().decode(bytes);
			return JSON.parse(text);
		} catch (error) {
			return null;
		}
	}

	function normalizeColor(value, fallback) {
		if (!value || typeof value !== "object") {
			console.log("[normalizeColor] Using fallback:", fallback);
			return fallback;
		}

		const clamp = (num) => {
			if (typeof num !== "number" || Number.isNaN(num)) {
				return 0;
			}
			return Math.max(0, Math.min(1, num));
		};

		const r = Math.round(clamp(value.r) * 255);
		const g = Math.round(clamp(value.g) * 255);
		const b = Math.round(clamp(value.b) * 255);
		const result = `rgb(${r}, ${g}, ${b})`;
		console.log("[normalizeColor] Normalized:", { input: value, output: result });
		return result;
	}

	function normalizeHexColor(value, fallback) {
		if (typeof value !== "string" || value.length === 0) {
			console.log("[normalizeHexColor] Using fallback:", fallback);
			return fallback;
		}

		const cleaned = value.startsWith("#") ? value.substring(1) : value;
		if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
			const result = `#${cleaned}`;
			console.log("[normalizeHexColor] Normalized:", { input: value, output: result });
			return result;
		}

		console.log("[normalizeHexColor] Invalid hex, using fallback:", fallback);
		return fallback;
	}

	function luminanceFromRGB(rgbString) {
		const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
		if (!match) {
			return 0.5;
		}

		const r = Number(match[1]) / 255;
		const g = Number(match[2]) / 255;
		const b = Number(match[3]) / 255;
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	}

	function decodeBase64UrlToBytes(encoded) {
		let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
		const pad = (4 - (base64.length % 4)) % 4;
		if (pad > 0) {
			base64 = base64 + "=".repeat(pad);
		}

		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i += 1) {
			bytes[i] = binary.charCodeAt(i);
		}

		return bytes;
	}

	async function decodePayloadWithDeflate(encoded) {
		try {
			const compressedBytes = decodeBase64UrlToBytes(encoded);
			console.log("[decodePayloadWithDeflate] Base64URL decoded bytes:", compressedBytes.length);

			if (typeof DecompressionStream === "undefined") {
				console.log("[decodePayloadWithDeflate] DecompressionStream unavailable");
				return null;
			}

			const tryDecode = async (format) => {
				const inputStream = new Blob([compressedBytes]).stream();
				const decompressedStream = inputStream.pipeThrough(new DecompressionStream(format));
				const decompressedBuffer = await new Response(decompressedStream).arrayBuffer();
				const text = new TextDecoder().decode(decompressedBuffer);
				return JSON.parse(text);
			};

			try {
				const payload = await tryDecode("deflate");
				console.log("[decodePayloadWithDeflate] Deflate decode successful");
				return payload;
			} catch (deflateError) {
				console.log("[decodePayloadWithDeflate] Deflate decode failed, trying deflate-raw:", deflateError.message);
				const payload = await tryDecode("deflate-raw");
				console.log("[decodePayloadWithDeflate] Deflate-raw decode successful");
				return payload;
			}
		} catch (error) {
			console.log("[decodePayloadWithDeflate] Deflate decode failed:", error.message);
			return null;
		}
	}


	function applyCardColors(accentColor, edgeColor) {
		console.log("[applyCardColors] Applying colors:", { accentColor, edgeColor });

		cardShell.style.setProperty("--card-bg", accentColor);
		const luminance = luminanceFromRGB(accentColor);
		const darkText = luminance > 0.72;

		console.log("[applyCardColors] Luminance:", luminance, "Dark text:", darkText);

		if (darkText) {
			cardShell.style.setProperty("--card-text-primary", "rgba(28, 22, 18, 0.95)");
			cardShell.style.setProperty("--card-text-secondary", "rgba(28, 22, 18, 0.72)");
		} else {
			cardShell.style.setProperty("--card-text-primary", "rgba(255, 255, 255, 0.95)");
			cardShell.style.setProperty("--card-text-secondary", "rgba(255, 255, 255, 0.72)");
		}

		nameEl.style.color = edgeColor;
		console.log("[applyCardColors] Complete");
	}

	function renderQRCode(link) {
		console.log("[renderQRCode] Rendering QR for link:", link.substring(0, 50) + "...");

		if (!window.QRCodeStyling || !qrCanvas) {
			console.error("[renderQRCode] QRCodeStyling unavailable or canvas not found");
			setStatus("QR generator unavailable. You can still open the app link.");
			return;
		}

		qrCanvas.innerHTML = "";

		try {
			qrCodeInstance = new window.QRCodeStyling({
				width: 280,
				height: 280,
				type: "canvas",
				data: link,
				margin: 0,
				qrOptions: {
					errorCorrectionLevel: "M"
				},
				dotsOptions: {
					color: "#111111",
					type: "rounded"
				},
				backgroundOptions: {
					color: "#ffffff"
				}
			});

			qrCodeInstance.append(qrCanvas);
			console.log("[renderQRCode] QR code rendered successfully");
		} catch (error) {
			console.error("[renderQRCode] Error rendering QR:", error);
			setStatus("Could not render QR code. You can still open the app link.");
		}
	}

	function attachActions(link) {
		console.log("[attachActions] Attaching actions for link:", link.substring(0, 50) + "...");

		openInAppEl.href = link;

		openInAppEl.addEventListener("click", function () {
			console.log("[attachActions] Open in app clicked");
			setStatus("Opening in Horika...");
			if (!/iPhone/i.test(navigator.userAgent)) {
				setStatus("Use this link on iPhone with Horika installed.");
			}
		});

		copyLinkEl.addEventListener("click", async function () {
			console.log("[attachActions] Copy link clicked");
			try {
				await navigator.clipboard.writeText(link);
				console.log("[attachActions] Link copied successfully");
				setStatus("App link copied.");
			} catch (error) {
				console.error("[attachActions] Copy failed:", error);
				setStatus("Could not copy automatically. Link is available in Open in Horika.");
			}
		});

		console.log("[attachActions] Complete");
	}

	function renderFromPayload(encoded, decoded, hashFields) {
		console.log("[renderFromPayload] Start", { decoded, hashFields });

		const safeName = (decoded && typeof decoded.n === "string" && decoded.n.trim())
			? decoded.n.trim()
			: (hashFields.name || "Horika Film");
		const safeDescription = (decoded && typeof decoded.d === "string" && decoded.d.trim())
			? decoded.d.trim()
			: (hashFields.description || "A shared Film Lab profile.");
		const accentColor = decoded && decoded.b
			? normalizeColor(decoded.b, "rgb(212, 160, 64)")
			: normalizeHexColor(hashFields.baseColor, "rgb(212, 160, 64)");
		const edgeColor = decoded && decoded.e
			? normalizeColor(decoded.e, "rgb(255, 255, 255)")
			: normalizeHexColor(hashFields.edgeColor, "rgb(255, 255, 255)");

		console.log("[renderFromPayload] Resolved colors", { accentColor, edgeColor });

		nameEl.textContent = safeName;
		descriptionEl.textContent = safeDescription;
		console.log("[renderFromPayload] Updated name/description", { safeName, safeDescription });

		applyCardColors(accentColor, edgeColor);
		if (decoded && decoded.c) {
			console.log("[renderFromPayload] Configuration decoded successfully");
		}

		console.log("[renderFromPayload] Complete");
	}

	async function start() {
		console.log("[start] Page initialization starting");
		console.log("[start] URL:", window.location.href);

		const encodedData = parseHashData();
		console.log("[start] Encoded data parsed:", { length: encodedData.length, data: encodedData.substring(0, 50) + "..." });

		const hashFields = parseHashFields();
		console.log("[start] Hash fields parsed:", hashFields);

		const hasValidData = isValidEncodedPayload(encodedData);
		console.log("[start] Data validation result:", hasValidData);

		if (!hasValidData) {
			console.log("[start] Invalid data - showing fallback");
			setStatus("Invalid or missing share data. Install Horika to import shares from valid links.");
			const fallbackLink = APP_STORE_URL;
			openInAppEl.href = fallbackLink;
			openInAppEl.textContent = "Download Horika";
			copyLinkEl.disabled = true;
			console.log("[start] Fallback rendering complete");
			return;
		}

		console.log("[start] Valid data found - decoding payload");
		const deepLink = FILM_LAB_PREFIX + encodedData;
		console.log("[start] Deep link:", deepLink.substring(0, 50) + "...");

		// Try native deflate decode first
		let decoded = await decodePayloadWithDeflate(encodedData);
		if (!decoded) {
			console.log("[start] Deflate decode failed, trying plain base64");
			decoded = decodePayloadIfPlainBase64(encodedData);
		}

		console.log("[start] Payload decode result:", decoded ? "Success" : "Failed");

		renderFromPayload(encodedData, decoded, hashFields);
		renderQRCode(deepLink);
		attachActions(deepLink);

		if (!decoded) {
			setStatus("Preview uses shared style colors. Full profile opens in Horika.");
		}

		console.log("[start] Complete");
	}

	start().catch(function (error) {
		console.error("[start] Unexpected failure:", error);
		setStatus("Unable to process this share link.");
	});
})();
