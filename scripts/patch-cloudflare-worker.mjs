import fs from "node:fs";
import path from "node:path";

const serverDir = path.resolve(".output/server");

function patchFile(fullPath) {
  let content = fs.readFileSync(fullPath, "utf8");
  const runtimeStart = content.indexOf("//#region \\0rolldown/runtime.js");
  if (runtimeStart === -1) return false;

  const runtimeEnd = content.indexOf("//#endregion", runtimeStart) + 12;

  const hoistedRuntime = `//#region \\0rolldown/runtime.js
function __create(proto) { return Object.create(proto); }
function __defProp(o, p, a) { return Object.defineProperty(o, p, a); }
function __getOwnPropDesc(o, p) { return Object.getOwnPropertyDescriptor(o, p); }
function __getOwnPropNames(o) { return Object.getOwnPropertyNames(o); }
function __getProtoOf(o) { return Object.getPrototypeOf(o); }
function __esmMin(fn, res, err) { return () => { if (err) throw err[0]; try { return fn && (res = fn(fn = 0)), res; } catch (e) { throw err = [e], e; } }; }
function __commonJSMin(cb, mod) { return () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports); }
function __exportAll(all, no_symbols) {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
}
function __copyProps(to, from, except, desc) {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!Object.prototype.hasOwnProperty.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
}
function __toESM(mod, isNodeMode, target) {
	return (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !Object.prototype.hasOwnProperty.call(mod, "default") ? __defProp(target, "default", {
		value: mod,
		enumerable: true
	}) : target, mod));
}
function __toCommonJS(mod) {
	return Object.prototype.hasOwnProperty.call(mod, "module.exports") ? mod["module.exports"] : __copyProps(__defProp({}, "__esModule", { value: true }), mod);
}
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url || "file:///"))();
//#endregion`;

  content = content.slice(0, runtimeStart) + hoistedRuntime + content.slice(runtimeEnd);
  fs.writeFileSync(fullPath, content);
  return true;
}

function walkDir(dir) {
  let count = 0;
  if (!fs.existsSync(dir)) return count;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += walkDir(fullPath);
    } else if (entry.name.endsWith(".mjs") || entry.name.endsWith(".js")) {
      if (patchFile(fullPath)) count++;
    }
  }
  return count;
}

if (fs.existsSync(serverDir)) {
  const patched = walkDir(serverDir);
  console.log(`[patch-cloudflare-worker] Patched ${patched} chunk(s) for cyclic ES module hoisting.`);
} else {
  console.warn("[patch-cloudflare-worker] .output/server does not exist, skipping.");
}
