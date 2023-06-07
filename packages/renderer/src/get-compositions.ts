import type {AnyCompMetadata} from 'remotion';
import type {BrowserExecutable} from './browser-executable';
import type {BrowserLog} from './browser-log';
import type {HeadlessBrowser} from './browser/Browser';
import type {Page} from './browser/BrowserPage';
import {handleJavascriptException} from './error-handling/handle-javascript-exception';
import {findRemotionRoot} from './find-closest-package-json';
import {getPageAndCleanupFn} from './get-browser-instance';
import type {ChromiumOptions} from './open-browser';
import type {RemotionServer} from './prepare-server';
import {makeOrReuseServer} from './prepare-server';
import {puppeteerEvaluateWithCatch} from './puppeteer-evaluate';
import {waitForReady} from './seek-to-frame';
import {setPropsAndEnv} from './set-props-and-env';
import {validatePuppeteerTimeout} from './validate-puppeteer-timeout';

export type GetCompositionsOptions = {
	inputProps?: Record<string, unknown> | null;
	envVariables?: Record<string, string>;
	puppeteerInstance?: HeadlessBrowser;
	onBrowserLog?: (log: BrowserLog) => void;
	browserExecutable?: BrowserExecutable;
	timeoutInMilliseconds?: number;
	chromiumOptions?: ChromiumOptions;
	port?: number | null;
	/**
	 * @deprecated Only for Remotion internal usage
	 */
	server?: RemotionServer;
	/**
	 * @deprecated Only for Remotion internal usage
	 */
	indent?: boolean;
	verbose?: boolean;
};

const innerGetCompositions = async (
	serveUrl: string,
	page: Page,
	config: GetCompositionsOptions,
	proxyPort: number
): Promise<AnyCompMetadata[]> => {
	if (config?.onBrowserLog) {
		page.on('console', (log) => {
			config.onBrowserLog?.({
				stackTrace: log.stackTrace(),
				text: log.text,
				type: log.type,
			});
		});
	}

	validatePuppeteerTimeout(config?.timeoutInMilliseconds);

	await setPropsAndEnv({
		inputProps: config?.inputProps ?? {},
		envVariables: config?.envVariables,
		page,
		serveUrl,
		initialFrame: 0,
		timeoutInMilliseconds: config?.timeoutInMilliseconds,
		proxyPort,
		retriesRemaining: 2,
		audioEnabled: false,
		videoEnabled: false,
	});

	await puppeteerEvaluateWithCatch({
		page,
		pageFunction: () => {
			window.remotion_setBundleMode({
				type: 'evaluation',
			});
		},
		frame: null,
		args: [],
	});

	await waitForReady(page);
	const result = await puppeteerEvaluateWithCatch({
		pageFunction: () => {
			return window.getStaticCompositions();
		},
		frame: null,
		page,
		args: [],
	});

	return result as AnyCompMetadata[];
};

type CleanupFn = () => void;

/**
 * @description Gets the compositions defined in a Remotion project based on a Webpack bundle.
 * @see [Documentation](https://www.remotion.dev/docs/renderer/get-compositions)
 */
export const getCompositions = async (
	serveUrlOrWebpackUrl: string,
	config?: GetCompositionsOptions
) => {
	const {page, cleanup: cleanupPage} = await getPageAndCleanupFn({
		passedInInstance: config?.puppeteerInstance,
		browserExecutable: config?.browserExecutable ?? null,
		chromiumOptions: config?.chromiumOptions ?? {},
		context: null,
		forceDeviceScaleFactor: undefined,
		indent: config?.indent ?? false,
		shouldDumpIo: config?.verbose ?? false,
	});

	const cleanup: CleanupFn[] = [cleanupPage];

	return new Promise<AnyCompMetadata[]>((resolve, reject) => {
		const onError = (err: Error) => reject(err);

		cleanup.push(
			handleJavascriptException({
				page,
				frame: null,
				onError,
			})
		);

		makeOrReuseServer(
			config?.server,
			{
				webpackConfigOrServeUrl: serveUrlOrWebpackUrl,
				port: config?.port ?? null,
				remotionRoot: findRemotionRoot(),
				concurrency: 1,
				verbose: config?.verbose ?? false,
				indent: config?.indent ?? false,
			},
			{
				onDownload: () => undefined,
				onError,
			}
		)
			.then(({server: {serveUrl, offthreadPort, sourceMap}, cleanupServer}) => {
				page.setBrowserSourceMapContext(sourceMap);

				cleanup.push(() => cleanupServer(true));

				return innerGetCompositions(
					serveUrl,
					page,
					config ?? {},
					offthreadPort
				);
			})

			.then((comp) => {
				return resolve(comp);
			})
			.catch((err) => {
				reject(err);
			})
			.finally(() => {
				cleanup.forEach((c) => {
					c();
				});
			});
	});
};
