<script setup>
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useProjectStore } from '../stores/project';
import { useRoute } from 'vue-router';
const store = useProjectStore()
const route = useRoute()
const project = ref(null);
if (!store.list.length) {
    store.load().then(init)
} else {
    init()
}
async function init() {
    project.value = store.list.filter(p => p.id == route.query.id)[0]
    await store.prepare(project.value)
    await store.loadTracks(project.value)
}

const playSources = computed(() => store.getProjectSources(project.value))
const totalLen = computed(() => {
    const sorted = playSources.value.sort((a, b) => a.when + a.duration - b.when - b.duration)
    const lastPiece = sorted[sorted.length - 1]
    const result = lastPiece.when + lastPiece.duration
    return result || 1
})

const paragraphDelta = computed({
    get: () => project.value ? [project.value.cfg.paragraphDelta || 5] : [5],
    set: (value) => {
        project.value.cfg.paragraphDelta = value[0];
        store.saveProject(project.value)
    }
})

function dosave() {
    store.saveProject(project.value)
}

async function loadAudio(e) {
    const file = e.target.files[0]
    const { path } = await api.call(
        "loadTrack",
        project.value.id,
        file.path
    );
    return {
        name: file.name,
        path,
    }
}

async function onSelectPianTou(e) {
    const info = await loadAudio(e)
    project.value.cfg.piantou = { ...info }
    store.saveProject(project.value)
    store.loadTracks()
}

async function onSelectPianWei(e) {
    const info = await loadAudio(e)
    project.value.cfg.pianwei = { ...info }
    store.saveProject(project.value)
    store.loadTracks()
}

async function onSelectBGM(e) {
    const info = await loadAudio(e)
    project.value.cfg.bgm = { ...info }
    store.saveProject(project.value)
    store.loadTracks()
}

const playProgress = ref([0])
async function setProgress() {
    if (store.stop) {
        store.stop()
        await new Promise(r => setTimeout(r, 200))
        store.play(playSources.value, playProgress.value[0] / 100)
    }
}

watch(() => store.playProgress, async () => {
    playProgress.value = [store.playProgress * 100];
})

function vols2line(piece) {
    const start = piece.when
    const duration = piece.duration
    const vols = piece.volumns || []
    const lines = []
    if (!vols || !vols.length) return []
    for (let i = 1; i < vols.length; i++) {
        lines.push({
            x1: vols[i - 1].at * 100 / totalLen.value,
            y1: (1 - vols[i - 1].volumn) * 100,
            x2: vols[i].at * 100 / totalLen.value,
            y2: (1 - vols[i].volumn) * 100,
        })
    }
    lines.push({
        x1: vols[vols.length - 1].at * 100 / totalLen.value,
        y1: (1 - vols[vols.length - 1].volumn) * 100,
        x2: (start + duration) * 100 / totalLen.value,
        y2: (1 - vols[vols.length - 1].volumn) * 100,
    })
    return lines
}

async function doPlay() {
    await store.loadTracks(project.value);
    store.play(playSources.value, playProgress.value[0] / 100)
}

</script>
<template>
    <div v-if="project">
        <div class="overflow-x-auto">
            <div class="flex relative  mt-[50px] bg-green-100 h-[100px]">
                <div v-for="piece in playSources.filter(p => p.type == 'content' || p.type == 'hot')"
                    :style="{ left: `${piece.when * 100 / totalLen}%`, width: `${piece.duration * 100 / totalLen}%` }"
                    :data-type="piece.type" class="absolute h-[100px] bg-gray-200 data-[type='hot']:bg-orange-200">
                </div>
            </div>
            <div v-if="project.cfg.piantou && project.cfg.usePianTou" class="flex relative  bg-green-100 h-[50px]">
                <div v-for="piece in playSources.filter(p => p.type == 'piantou')"
                    :style="{ left: `${piece.when * 100 / totalLen}%`, width: `${piece.duration * 100 / totalLen}%` }"
                    class="absolute h-[100px] bg-red-200">
                </div>
                <svg v-for="piece in playSources.filter(p => p.type == 'piantou')" style="width:100%;height:100%;"
                    class="absolute left-0 top-0">
                    <line v-for="line in vols2line(piece)" :x1="`${line.x1}%`" :y1="`${line.y1}%`" :x2="`${line.x2}%`"
                        :y2="`${line.y2}%`" style="stroke: red;stroke-width: 2;"></line>
                </svg>
            </div>
            <div v-if="project.cfg.bgm && project.cfg.useBGM" class="flex relative overflow-x-auto bg-green-100 h-[50px]">
                <div v-for="piece in playSources.filter(p => p.type == 'bgm')"
                    :style="{ left: `${piece.when * 100 / totalLen}%`, width: `${piece.duration * 100 / totalLen}%` }"
                    class="absolute h-[100px] bg-blue-200">
                </div>
                <svg v-for="piece in playSources.filter(p => p.type == 'bgm')" style="width:100%;height:100%;"
                    class="absolute left-0 top-0">
                    <line v-for="line in vols2line(piece)" :x1="`${line.x1}%`" :y1="`${line.y1}%`" :x2="`${line.x2}%`"
                        :y2="`${line.y2}%`" style="stroke: red;stroke-width: 2;"></line>
                </svg>
            </div>
            <div v-if="project.cfg.pianwei && project.cfg.usePianWei" class="flex relative  bg-green-100 h-[50px]">
                <div v-for="piece in playSources.filter(p => p.type == 'pianwei')"
                    :style="{ left: `${piece.when * 100 / totalLen}%`, width: `${piece.duration * 100 / totalLen}%` }"
                    class="absolute h-[100px] bg-yellow-200">
                </div>
                <svg v-for="piece in playSources.filter(p => p.type == 'pianwei')" style="width:100%;height:100%;"
                    class="absolute left-0 top-0">
                    <line v-for="line in vols2line(piece)" :x1="`${line.x1}%`" :y1="`${line.y1}%`" :x2="`${line.x2}%`"
                        :y2="`${line.y2}%`" style="stroke: red;stroke-width: 2;"></line>
                </svg>
            </div>

        </div>
        <div class="p-5 bg-gray-300 mt-[50px]">
            <SliderRoot v-model="playProgress" @update:modelValue="setProgress"
                class="relative flex items-center select-none touch-none  h-5" :min="0" :max="100" :step="1">
                <SliderTrack class="bg-gray-100 relative grow rounded-full h-[3px]">
                    <SliderRange class="absolute bg-white rounded-full h-full" />
                </SliderTrack>
                <SliderThumb
                    class="block w-5 h-5 bg-white shadow-[0_2px_10px] shadow-blackA7 rounded-[10px] hover:bg-violet3 focus:outline-none"
                    aria-label="Volume" />
            </SliderRoot>
        </div>
        <div class="mt-[50px] bg-gray-300 p-5">
            <fieldset class="mb-[15px] flex items-center">
                <label class="w-[90px] text-right text-[15px] mr-3" for="name"> 段落间隔 </label>
                <SliderRoot v-model="paragraphDelta" class="relative flex-1 flex items-center select-none touch-none  h-5"
                    :min="1" :max="50" :step="1">
                    <SliderTrack class="bg-gray-100 relative grow rounded-full h-[3px]">
                        <SliderRange class="absolute bg-white rounded-full h-full" />
                    </SliderTrack>
                    <SliderThumb
                        class="block w-5 h-5 bg-white shadow-[0_2px_10px] shadow-blackA7 rounded-[10px] hover:bg-violet3 focus:outline-none"
                        aria-label="Volume" />
                </SliderRoot>
            </fieldset>
            <fieldset class="mb-[15px] flex items-center">
                <label class=" w-[90px] text-right text-[15px] mr-3" for="name"> 片头曲 </label>
                <CheckboxRoot v-model:checked="project.cfg.usePianTou" @update:checked="dosave"
                    class="mr-2 shadow-gray-700 hover:bg-green-300 flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-[4px] bg-white shadow-[0_2px_10px] outline-none">
                    <CheckboxIndicator class="bg-white h-full w-full rounded flex items-center justify-center">
                        <Icon icon="radix-icons:check" class="h-3.5 w-3.5 text-grass11" />
                    </CheckboxIndicator>
                </CheckboxRoot>
                <label for="music-piantou" class="">
                    <span
                        class="data-[disabled=true]:text-gray-300 data-[disabled=true]:hover:bg-gray-200 mr-2 h-[35px] bg-gray-200 text-blue-500 font-semibold hover:bg-gray-300 shadow-sm inline-flex  items-center justify-center rounded-[4px] px-[15px] leading-none outline-none transition-all">
                        {{ project.cfg.piantou ? project.cfg.piantou.name : '添加片头音乐' }}
                    </span>
                    <input id="music-piantou" class="hidden" @change="onSelectPianTou" accept=".wav, .mp3, .m4a"
                        type="file" />
                </label>
            </fieldset>
            <fieldset class="mb-[15px] flex items-center">
                <label class=" w-[90px] text-right text-[15px] mr-3" for="name"> 背景音乐 </label>
                <CheckboxRoot v-model:checked="project.cfg.useBGM" @update:checked="dosave"
                    class="mr-2 shadow-gray-700 hover:bg-green-300 flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-[4px] bg-white shadow-[0_2px_10px] outline-none">
                    <CheckboxIndicator class="bg-white h-full w-full rounded flex items-center justify-center">
                        <Icon icon="radix-icons:check" class="h-3.5 w-3.5 text-grass11" />
                    </CheckboxIndicator>
                </CheckboxRoot>
                <label for="music-bg">
                    <span
                        class="data-[disabled=true]:text-gray-300 data-[disabled=true]:hover:bg-gray-200 mr-2  h-[35px] bg-gray-200 text-blue-500 font-semibold hover:bg-gray-300 shadow-sm inline-flex  items-center justify-center rounded-[4px] px-[15px] leading-none outline-none transition-all">
                        {{ project.cfg.bgm ? project.cfg.bgm.name : '添加背景音乐' }}
                    </span>
                    <input id="music-bg" class="hidden" @change="onSelectBGM" accept=".wav, .mp3, .m4a" type="file" />
                </label>
            </fieldset>
            <fieldset class="mb-[15px] flex items-center">
                <label class=" w-[90px] text-right text-[15px] mr-3" for="name"> 片尾曲 </label>
                <CheckboxRoot v-model:checked="project.cfg.usePianWei" @update:checked="dosave"
                    class="mr-2 shadow-gray-700 hover:bg-green-300 flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-[4px] bg-white shadow-[0_2px_10px] outline-none">
                    <CheckboxIndicator class="bg-white h-full w-full rounded flex items-center justify-center">
                        <Icon icon="radix-icons:check" class="h-3.5 w-3.5 text-grass11" />
                    </CheckboxIndicator>
                </CheckboxRoot>
                <label for="music-pianwei">
                    <span
                        class="data-[disabled=true]:text-gray-300 data-[disabled=true]:hover:bg-gray-200 mr-2 h-[35px] bg-gray-200 text-blue-500 font-semibold hover:bg-gray-300 shadow-sm inline-flex  items-center justify-center rounded-[4px] px-[15px] leading-none outline-none transition-all">
                        {{ project.cfg.pianwei ? project.cfg.pianwei.name : '添加片尾音乐' }}
                    </span>
                    <input id="music-pianwei" class="hidden" @change="onSelectPianWei" accept=".wav, .mp3, .m4a"
                        type="file" />
                </label>
            </fieldset>
            <label v-if="project" class="flex flex-row gap-4 items-center [&>.checkbox]:hover:bg-red-100">
                <CheckboxRoot v-model:checked="project.cfg.showHots" @update:checked="dosave"
                    class="shadow-gray-700 hover:bg-green-300 flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-[4px] bg-white shadow-[0_2px_10px] outline-none">
                    <CheckboxIndicator class="bg-white h-full w-full rounded flex items-center justify-center">
                        <Icon icon="radix-icons:check" class="h-3.5 w-3.5 text-grass11" />
                    </CheckboxIndicator>
                </CheckboxRoot>
                <span class="select-none">使用金句列表</span>
            </label>
        </div>
        <div class="mt-[50px] bg-gray-300 p-5 text-right">
            <button v-if="store.stop" @click="store.stop()"
                class="text-green-800 mr-5 font-semibold shadow-gray-700 hover:bg-green-300 inline-flex h-[35px] items-center justify-center rounded-[4px] bg-white px-[15px] leading-none shadow-[0_2px_10px] focus:outline-none">停止</button>
            <button v-else @click="doPlay"
                class="text-green-800 mr-5 font-semibold shadow-gray-700 hover:bg-green-300 inline-flex h-[35px] items-center justify-center rounded-[4px] bg-white px-[15px] leading-none shadow-[0_2px_10px] focus:outline-none">播放</button>
            <button v-if="!store.stop"
                class="text-green-800 mr-5 font-semibold shadow-gray-700 hover:bg-green-300 inline-flex h-[35px] items-center justify-center rounded-[4px] bg-white px-[15px] leading-none shadow-[0_2px_10px] focus:outline-none">导出</button>
        </div>
    </div>
</template>