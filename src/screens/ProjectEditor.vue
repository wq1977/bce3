<script setup>
import { ref, computed } from 'vue';
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
}

const hotlines = computed(() => store.getHotLines(project.value))
const blocks = computed(() => store.getContentBlocks(project.value))

const showHots = ref(true)
const paragraphDelta = ref([5])
const secondScale = ref([5]) 
</script>
<template>
    <div>
        <div class="flex overflow-x-auto mt-[50px]">
            <div v-for="line in hotlines" v-if="showHots" class="flex">
                <div :style="{ width: `${paragraphDelta[0] * secondScale[0]}px` }"
                    class="bg-green-300 cursor-default h-[100px]"></div>
                <div :style="{ width: `${line.duration * secondScale[0] / 44100}px` }" :title="line.text"
                    class="flex items-center whitespace-nowrap cursor-default justify-center bg-gray-300 overflow-hidden h-[100px]">
                    {{ line.text }}</div>
            </div>
            <div v-for="block in blocks" class="flex">
                <div :style="{ width: `${paragraphDelta[0] * secondScale[0]}px` }"
                    class="bg-green-300 cursor-default h-[100px]"></div>
                <div :style="{ width: `${block.duration * secondScale[0] / 44100}px` }" :title="block.title"
                    class="flex items-center whitespace-nowrap cursor-default justify-center bg-gray-300 overflow-hidden h-[100px]">
                    {{ block.title }}</div>
            </div>
            <div :style="{ minWidth: `${paragraphDelta[0] * secondScale[0]}px` }" class="bg-green-300 h-[100px]"></div>
        </div>
        <div class="p-5 bg-gray-300 mt-[50px]">
            <SliderRoot v-model="secondScale" class="relative flex items-center select-none touch-none  h-5" :min="1"
                :max="50" :step="1">
                <SliderTrack class="bg-gray-100 relative grow rounded-full h-[3px]">
                    <SliderRange class="absolute bg-white rounded-full h-full" />
                </SliderTrack>
                <SliderThumb
                    class="block w-5 h-5 bg-white shadow-[0_2px_10px] shadow-blackA7 rounded-[10px] hover:bg-violet3 focus:outline-none"
                    aria-label="Volume" />
            </SliderRoot>
        </div>
        <div class="mt-[50px] bg-gray-300 p-5">
            <fieldset class="mb-[15px] flex items-center gap-5">
                <label class=" w-[90px] text-right text-[15px]" for="name"> 段落间隔 </label>
                <SliderRoot v-model="paragraphDelta" class="relative w-full flex items-center select-none touch-none  h-5"
                    :min="1" :max="50" :step="1">
                    <SliderTrack class="bg-gray-100 relative grow rounded-full h-[3px]">
                        <SliderRange class="absolute bg-white rounded-full h-full" />
                    </SliderTrack>
                    <SliderThumb
                        class="block w-5 h-5 bg-white shadow-[0_2px_10px] shadow-blackA7 rounded-[10px] hover:bg-violet3 "
                        aria-label="Volume" />
                </SliderRoot>
            </fieldset>
            <fieldset class="mb-[15px] flex items-center gap-5">
                <label class=" w-[90px] text-right text-[15px]" for="name"> 片头曲 </label>
                <label for="music-piantou" class="w-full">
                    <span
                        class="data-[disabled=true]:text-gray-300 data-[disabled=true]:hover:bg-gray-200 mr-2 h-[35px] bg-gray-200 text-blue-500 font-semibold hover:bg-gray-300 shadow-sm inline-flex  items-center justify-center rounded-[4px] px-[15px] leading-none outline-none transition-all">添加片头音乐</span>
                    <input id="music-piantou" class="hidden" @change="onSelectFiles" accept=".wav, .mp3, .m4a"
                        type="file" />
                </label>
            </fieldset>
            <fieldset class="mb-[15px] flex items-center gap-5">
                <label class=" w-[90px] text-right text-[15px]" for="name"> 背景音乐 </label>
                <label for="music-bg" class="w-full">
                    <span
                        class="data-[disabled=true]:text-gray-300 data-[disabled=true]:hover:bg-gray-200 mr-2  h-[35px] bg-gray-200 text-blue-500 font-semibold hover:bg-gray-300 shadow-sm inline-flex  items-center justify-center rounded-[4px] px-[15px] leading-none outline-none transition-all">添加背景音乐</span>
                    <input id="music-bg" class="hidden" @change="onSelectFiles" accept=".wav, .mp3, .m4a" type="file" />
                </label>
            </fieldset>
            <fieldset class="mb-[15px] flex items-center gap-5">
                <label class=" w-[90px] text-right text-[15px]" for="name"> 片尾曲 </label>
                <label for="music-pianwei" class="w-full">
                    <span
                        class="data-[disabled=true]:text-gray-300 data-[disabled=true]:hover:bg-gray-200 mr-2 h-[35px] bg-gray-200 text-blue-500 font-semibold hover:bg-gray-300 shadow-sm inline-flex  items-center justify-center rounded-[4px] px-[15px] leading-none outline-none transition-all">添加片尾音乐</span>
                    <input id="music-pianwei" class="hidden" @change="onSelectFiles" accept=".wav, .mp3, .m4a"
                        type="file" />
                </label>
            </fieldset>
            <label class="flex flex-row gap-4 items-center [&>.checkbox]:hover:bg-red-100">
                <CheckboxRoot v-model:checked="showHots"
                    class="shadow-gray-700 hover:bg-green-300 flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-[4px] bg-white shadow-[0_2px_10px] outline-none">
                    <CheckboxIndicator class="bg-white h-full w-full rounded flex items-center justify-center">
                        <Icon icon="radix-icons:check" class="h-3.5 w-3.5 text-grass11" />
                    </CheckboxIndicator>
                </CheckboxRoot>
                <span class="select-none">使用金句列表</span>
            </label>
        </div>
    </div>
</template>