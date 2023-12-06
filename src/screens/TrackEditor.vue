<script setup>
import { Icon } from '@iconify/vue';
import Draggable from 'vuedraggable'
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project';

const store = useProjectStore()
const route = useRoute()
const router = useRouter()
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

const total = computed(() => Math.max(...((project.value ? project.value.tracks : []) || []).map(t => t.origin.reduce((r, c) => r + (c.buffer ? c.buffer.duration : 0), 0))))

function clipwidth(clip) {
    return clip.buffer ? (clip.buffer.duration * 100 / total.value) : 0
}

function deleteBuffer(proj, track, buffer) {
    track.origin = track.origin.filter(o => o != buffer)
    store.saveProject(proj)
}

const playProgress = ref([0])
async function setProgress() {
    if (store.stop) {
        store.stop()
        await new Promise(r => setTimeout(r, 200))
        const seek = playProgress.value / 100
        store.playTracks(project.value, seek)
    }
}

watch(() => store.progress, async () => {
    if (store.progressType == 'play') {
        playProgress.value = [store.progress * 100];
    }
})

function playTrack() {
    store.playTracks(project.value, playProgress.value[0] / 100)
}

function onSelectFiles(e) {
    store.appendNewTracks(project.value, e.target.files)
}

async function doRecognition() {
    await store.recognition(project.value)
    if (project.value.words && project.value.words.length) {
        router.push(`/editor/paragraph?id=${project.value.id}`)
    }
}

</script>
<template>
    <div class="flex my-5">
        <span class="w-[100px]"></span>
        <SliderRoot v-model="playProgress" @update:modelValue="setProgress"
            class="relative p-2 flex-1 flex items-center select-none touch-none w-[200px] h-5" :max="100" :step="1">
            <SliderTrack class="bg-gray-300 relative grow rounded-full h-[3px]">
                <SliderRange class="absolute bg-pink-300 rounded-full h-full" />
            </SliderTrack>
            <SliderThumb
                class="block w-5 h-5 bg-white shadow-[0_2px_10px] shadow-gray-700 rounded-[10px] hover:bg-violet-300 focus:outline-none "
                aria-label="Volume" />
        </SliderRoot>
    </div>
    <div v-for="track in project ? project.tracks : []" class="flex items-center ">
        <span class="w-[100px]">{{ track.name }}</span>
        <Draggable v-model="track.origin" group="trackclip" class="flex flex-1 items-center p-2" item-key="name">
            <template #item="{ element }">
                <div v-if="element.buffer" :style="{ width: `${clipwidth(element)}%` }"
                    class="group relative bg-gray-200 border border-gray-300 flex justify-center text-sm p-2 font-bold text-gray-500 cursor-grab">
                    {{
                        element.name }}
                    <Icon @click.stop="deleteBuffer(project, track, element)" icon="fluent:delete-12-regular"
                        class="group-hover:inline hidden absolute text-lg right-1 top-1 text-blue-300 hover:text-blue-500" />
                </div>
            </template>
        </Draggable>
    </div>
    <div v-if="store.progressType == 'recognition'" class="mt-5 flex items-center justify-center h-[15px] rounded-lg ">
        <div
            class="px-[30vw] py-2 text-xs font-medium leading-none text-center text-blue-800 bg-blue-200 rounded-full animate-pulse">
            正在识别 {{ (store.progress * 100).toFixed(2) }} % ... </div>
    </div>
    <div class="mt-[50px] flex items-center justify-center">
        <label for="track-selector">
            <span :data-disabled="store.recognitionProgress >= 0"
                class="data-[disabled=true]:text-gray-300 data-[disabled=true]:hover:bg-gray-200 mr-2 w-[100px] h-[35px] bg-gray-200 text-blue-500 font-semibold hover:bg-gray-300 shadow-sm inline-flex  items-center justify-center rounded-[4px] px-[15px] leading-none outline-none transition-all">添加音轨</span>
            <input id="track-selector" :disabled="store.recognitionProgress >= 0" class="hidden" @change="onSelectFiles"
                accept=".wav, .mp3, .m4a" multiple type="file" />
        </label>
        <button @click="doRecognition" :disabled="store.recognitionProgress >= 0 || store.projectTrackLen(project) <= 0"
            class="disabled:text-gray-300 disabled:hover:bg-gray-200 mr-2 w-[100px] h-[35px] bg-gray-200 text-blue-500 font-semibold hover:bg-gray-300 shadow-sm inline-flex  items-center justify-center rounded-[4px] px-[15px] leading-none outline-none transition-all">开始识别</button>
        <button :disabled="store.progressType == 'recognition' || store.projectTrackLen(project) <= 0" v-if="!store.stop"
            @click="playTrack"
            class="disabled:text-gray-300 disabled:hover:bg-gray-200 mr-2 w-[100px] h-[35px] bg-gray-200 text-blue-500 font-semibold hover:bg-gray-300 shadow-sm inline-flex  items-center justify-center rounded-[4px] px-[15px] leading-none outline-none transition-all">播放</button>
        <button :disabled="store.progressType == 'recognition'" v-else @click="() => { store.stop(); store.stop = null; }"
            class="disabled:text-gray-300 disabled:hover:bg-gray-200 mr-2 w-[100px] h-[35px] bg-gray-200 text-blue-500 font-semibold hover:bg-gray-300 shadow-sm inline-flex  items-center justify-center rounded-[4px] px-[15px] leading-none outline-none transition-all">停止</button>
    </div>
</template>