import {
  CUSTOM_OPTION,
  parseLlmConfig,
  resolveLlmConfig,
  vendorOptions,
  modelOptions,
  ROUTES,
} from '../core/llm/catalog.js';
import { selectOption, clack } from './tui.js';

function buildMessage({ step, subtitle, title }) {
  const parts = [];
  if (step) parts.push(step);
  if (subtitle) parts.push(subtitle);
  if (parts.length) return parts.join(' - ');
  return title ?? 'Choose';
}

async function pickText({
  session,
  step,
  subtitle,
  placeholder,
  initialValue,
  required = 'Required',
}) {
  if (session) session.enter();

  const value = await clack.text({
    message: buildMessage({ step, subtitle }),
    placeholder,
    defaultValue: initialValue ?? '',
    validate: (v) => (!String(v || '').trim() ? required : undefined),
  });

  if (clack.isCancel(value)) return null;
  return String(value).trim();
}

/**
 * route → vendor → model 3단계 선택 (experiments @clack 스타일)
 * @param {{
 *   session?: import('./tui.js').TuiSession,
 *   step?: string,
 *   current?: { provider?: string, model?: string },
 *   labels?: Record<string, string>,
 * }} params
 * @returns {Promise<{ provider: string, model: string }|null>}
 */
export async function pickLlmConfig({
  session,
  step,
  current,
  labels = {},
} = {}) {
  const parsed = parseLlmConfig(current);
  const connection = labels.connection ?? 'Connection';
  const vendorDirect = labels.vendorDirect ?? 'API vendor';
  const vendorOpenRouter = labels.vendorOpenRouter ?? 'OpenRouter vendor';
  const modelLabel = labels.model ?? 'Model';
  const customLabel = labels.custom ?? 'Custom…';
  const customVendorDirect = labels.customVendorDirect ?? 'Custom API provider';
  const customVendorOpenRouter = labels.customVendorOpenRouter ?? 'Custom OpenRouter vendor prefix';
  const customModel = labels.customModel ?? 'Custom model id';
  const required = labels.required ?? 'Required';

  const route = await selectOption({
    session,
    step,
    subtitle: connection,
    options: Object.entries(ROUTES).map(([value, def]) => ({
      value,
      label: def.label,
    })),
    initialValue: parsed.route,
  });
  if (!route) return null;

  const vendor = await selectOption({
    session,
    step,
    subtitle: route === 'openrouter' ? vendorOpenRouter : vendorDirect,
    options: vendorOptions(route, { customLabel }),
    initialValue: parsed.vendor,
  });
  if (!vendor) return null;

  let customVendor = parsed.customVendor;
  if (vendor === CUSTOM_OPTION) {
    customVendor = await pickText({
      session,
      step,
      subtitle: route === 'openrouter' ? customVendorOpenRouter : customVendorDirect,
      placeholder: route === 'openrouter' ? 'mistralai' : 'claude',
      initialValue: customVendor,
      required,
    });
    if (!customVendor) return null;
  }

  const models = modelOptions(route, vendor, { customLabel });
  const model = await selectOption({
    session,
    step,
    subtitle: modelLabel,
    options: models,
    initialValue: parsed.model,
  });
  if (!model) return null;

  let resolvedModel = model;
  if (model === CUSTOM_OPTION) {
    const modelPlaceholder = route === 'openrouter'
      ? (customVendor ? `${customVendor}/model-id` : 'vendor/model-id')
      : route === 'direct' && vendor === CUSTOM_OPTION
        ? 'model-id'
        : 'gemini-2.5-flash';
    resolvedModel = await pickText({
      session,
      step,
      subtitle: customModel,
      placeholder: modelPlaceholder,
      initialValue: parsed.model,
      required,
    });
    if (!resolvedModel) return null;
  }

  return resolveLlmConfig({
    route,
    vendor,
    model: resolvedModel,
    customVendor,
  });
}
