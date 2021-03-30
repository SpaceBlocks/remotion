import React from 'react';
import {Audio, interpolate, Sequence, useCurrentFrame, Video} from 'remotion';
import {calculateAssetPositions} from '../assets/calculate-asset-positions';
import {MediaAsset} from '../assets/types';
import {getAssetsForMarkup} from './get-assets-for-markup';

const basicConfig = {
	width: 1080,
	height: 1080,
	fps: 30,
	durationInFrames: 60,
};

const getPositions = async (Markup: React.FC) => {
	const assets = await getAssetsForMarkup(Markup, basicConfig);
	return calculateAssetPositions(assets);
};

const withoutId = (asset: MediaAsset) => {
	const {id, ...others} = asset;
	return others;
};

test('Should be able to collect assets', async () => {
	const assetPositions = await getPositions(() => (
		<Video src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4" />
	));
	expect(assetPositions.length).toBe(1);
	expect(withoutId(assetPositions[0])).toEqual({
		type: 'video',
		src:
			'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4',
		duration: 60,
		startInVideo: 0,
		trimLeft: 0,
		volume: 1,
		isRemote: true,
	});
});

test('Should get multiple assets', async () => {
	const assetPositions = await getPositions(() => (
		<div>
			<Video src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4" />
			<Audio src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp3" />
		</div>
	));
	expect(assetPositions.length).toBe(2);
	expect(withoutId(assetPositions[0])).toEqual({
		type: 'video',
		src:
			'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4',
		duration: 60,
		startInVideo: 0,
		trimLeft: 0,
		volume: 1,
		isRemote: true,
	});
	expect(withoutId(assetPositions[1])).toEqual({
		type: 'audio',
		src:
			'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp3',
		duration: 60,
		startInVideo: 0,
		trimLeft: 0,
		volume: 1,
		isRemote: true,
	});
});

test('Should handle jumps inbetween', async () => {
	const assetPositions = await getPositions(() => {
		const frame = useCurrentFrame();
		return (
			<div>
				{frame !== 20 ? (
					<Video src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4" />
				) : null}
			</div>
		);
	});
	expect(assetPositions.length).toBe(2);
	expect(withoutId(assetPositions[0])).toEqual({
		type: 'video',
		src:
			'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4',
		duration: 20,
		startInVideo: 0,
		trimLeft: 0,
		volume: 1,
		isRemote: true,
	});
	expect(withoutId(assetPositions[1])).toEqual({
		type: 'video',
		src:
			'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4',
		duration: 39,
		startInVideo: 21,
		trimLeft: 21,
		volume: 1,
		isRemote: true,
	});
});

test('Should support sequencing', async () => {
	const assetPositions = await getPositions(() => {
		return (
			<Sequence durationInFrames={30} from={-20}>
				<Video src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4" />
			</Sequence>
		);
	});
	expect(assetPositions.length).toBe(1);
	expect(withoutId(assetPositions[0])).toEqual({
		type: 'video',
		src:
			'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4',
		duration: 10,
		startInVideo: 0,
		trimLeft: 20,
		volume: 1,
		isRemote: true,
	});
});

test('Should calculate volumes correctly', async () => {
	const assetPositions = await getPositions(() => {
		return (
			<Video
				volume={(f) =>
					interpolate(f, [0, 4], [0, 1], {
						extrapolateRight: 'clamp',
					})
				}
				src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4"
			/>
		);
	});
	expect(assetPositions.length).toBe(1);
	expect(withoutId(assetPositions[0])).toEqual({
		type: 'video',
		src:
			'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4',
		duration: 60,
		startInVideo: 0,
		trimLeft: 0,
		isRemote: true,
		volume: new Array(60)
			.fill(true)
			.map((_, i) =>
				interpolate(i, [0, 4], [0, 1], {extrapolateRight: 'clamp'})
			),
	});
});
