<script setup>
import { Icon } from '@iconify/vue'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import WordAdjust from '../component/WordAdjust.vue'
import Draggable from 'vuedraggable'
import { useRoute } from 'vue-router';
import { useProjectStore } from '../stores/project';
const store = useProjectStore()
const route = useRoute()
const project = ref(null);
const paraRefs = ref(null)
const doAdjust = ref(false)
if (!store.list.length) {
    store.load().then(init)
} else {
    init()
}

const titlelist = computed({
    get: () => {
        const list = store.getContentBlocks(project.value).map(b => ({
            ...b
        }))
        let duration = 0;
        for (let block of list) {
            duration += block.duration
            block.duration = store.formatDuration(duration)
        }
        return list
    },
    set: (list) => {
        list.forEach((p, idx) => {
            project.value.paragraphs[p.index].sequence = idx + 1
        })
        store.saveParagraph(project.value)
    }
})

async function init() {
    project.value = store.list.filter(p => p.id == route.query.id)[0]
    await store.prepare(project.value)
    // await store.loadTracks(project.value)
    // project.value.words = store.fixLongWord(project.value.words, store.projectTrackLen(project.value))
    // await store.saveWords(project.value)
}

async function setComment(event, paragraphIdx) {
    const text = event.target.textContent.trim()
    if (text || paragraphIdx == 0) {
        project.value.paragraphs[paragraphIdx].comment = text
        store.saveParagraph(project.value);
    } else {
        store.mergeBackParagraph(project.value, paragraphIdx)
    }
}

function preventEnter(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        e.target.blur()
    }
}

function paragraphKeyDown(e, paragraphIdx, piece) {
    if (e.code == 'Enter') {
        const position = getSelection().baseOffset
        store.splitParagraph(project.value, paragraphIdx, piece, position)
    }
}

function focusParagraph(idx) {
    paraRefs.value[idx].scrollIntoView({ behavior: "smooth", });
}


const selWordStart = ref(null)
const selWordEnd = ref(null)
const selParagraph = ref(null)

watch(() => selWordEnd.value, () => {
    console.log('selword change to:', selWordEnd.value)
})

let selectionCheckTimer
function selectionChange(e) {
    if (selectionCheckTimer) {
        clearTimeout(selectionCheckTimer)
    }
    selectionCheckTimer = setTimeout(() => {
        selectionCheckTimer = null
        pieceMouseup(e)
    }, 300);
}
onMounted(() => {
    document.addEventListener('selectionchange', selectionChange);
})

onUnmounted(() => {
    document.removeEventListener('selectionchange', selectionChange)
})

function adjustWords() {
    setTimeout(() => {
        doAdjust.value = true
        const unwatch = watch(doAdjust, () => {
            unwatch()
            store.updateParagraphsPieces(project.value, selParagraph.value)
        })
    }, 100);
}

function playSelection() {
    store.playWords(project.value, selWordStart.value, selWordEnd.value)
}

function playFromHere() {
    if (selWordStart.value != null) {
        store.playWords(project.value, selWordStart.value, project.value.words.length)
    }
}

let clickWaitConfirm=false
function onTxtDbclick() {
    clickWaitConfirm  = false
    playFromHere()
}

function setSelectionTag(tag) {
    if (selWordStart.value != null && selWordEnd.value != null) {
        store.setTag(project.value, selWordStart.value, selWordEnd.value, tag)
    }
}

function setSelectionHot(value) {
    if (selWordStart.value != null && selWordEnd.value != null) {
        store.setHot(project.value, selParagraph.value, selWordStart.value, selWordEnd.value, value)
    }
}

function pieceMouseup(e) {
    clickWaitConfirm = true
    const range = document.caretRangeFromPoint(e.clientX, e.clientY)
    let nodeBase = range.startContainer
    if (nodeBase.nodeName !== 'SPAN') {
        nodeBase = nodeBase.parentNode
    }
    const paragraphIdxBase = parseInt(nodeBase.getAttribute('data-paragraph'))
    const pieceIdxBase = parseInt(nodeBase.getAttribute('data-piece'))
    const wordBase = store.getWordIndex(project.value, project.value.paragraphs[paragraphIdxBase].pieces[pieceIdxBase], range.startOffset)
    selWordStart.value = wordBase
    setTimeout(() => {
        if (clickWaitConfirm) {
            selWordStart.value = Math.max(0,wordBase-3)
            selWordEnd.value = wordBase + 3
            selParagraph.value = paragraphIdxBase
            if (store.stop) {
                store.stop()
            }
            adjustWords()
        }
    }, 300);
}

</script>
<template>
    <div v-if="project" class="relative">
        <div class="text-2xl font-black antialiased p-2">
            <input v-model="project.name" @change="store.saveProject(project)" placeholder="请输入单集标题" />
        </div>
        <ContextMenuRoot :modal="false">
            <ContextMenuTrigger :disabled="!selWordEnd">
                <div class="mr-[320px]">
                    <div ref="paraRefs" v-for="(paragraph, idx) in project.paragraphs"
                        class="text-justify leading-relaxed p-2 focus:outline-none " :key="paragraph.start">
                        <div>
                            <span contenteditable @keydown="preventEnter" @blur="setComment($event, idx)"
                                :data-used="!!paragraph.comment"
                                class="font-black text-gray-300 data-[used=true]:text-green-600 mr-2 px-1">
                                {{ `${paragraph.comment || '未使用'}` }}</span>
                            <Icon @click="store.playParagraph(project, paragraph)" icon="zondicons:play-outline"
                                class="inline mr-2" />
                            <span>&nbsp;&nbsp;</span>
                            <span v-for="(piece, pidx) in paragraph.pieces" :data-paragraph="idx" :data-piece="pidx"
                                :data-tag="piece.type || 'normal'" @dblclick="onTxtDbclick" @click="pieceMouseup"
                                :data-ishot="piece.ishot" @keydown="paragraphKeyDown($event, idx, piece)" tabindex="0"
                                class="leading-loose cursor-pointer select-none break-all focus:outline-none decoration-4 decoration-dashed data-[tag=mute]:underline data-[tag=beep]:line-through data-[ishot=true]:bg-orange-200 data-[tag=beep]:decoration-wavy data-[tag=beep]:text-blue-600 data-[tag=delete]:line-through data-[tag=delete]:text-red-600 antialiased">
                                {{ piece.text }} </span>
                        </div>

                    </div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuPortal>
                <ContextMenuContent
                    class=" min-w-[150px] z-30 bg-white outline-none rounded-md p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade"
                    :side-offset="5">
                    <ContextMenuItem
                        class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[18px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                        @click="playFromHere()">
                        <Icon icon="octicon:play-16" class="mr-2 w-[1em]" /> 从此处播放
                    </ContextMenuItem>
                    <ContextMenuItem
                        class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[18px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                        @click="playSelection()">
                        <Icon icon="octicon:play-16" class="mr-2 w-[1em]" /> 播放
                    </ContextMenuItem>
                    <ContextMenuItem
                        class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[18px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                        @click="adjustWords()">
                        <Icon icon="carbon:settings-adjust" class="mr-2 w-[1em]" /> 调整
                    </ContextMenuItem>
                    <ContextMenuSeparator class="h-[1px] bg-green-300 m-[5px]" />
                    <ContextMenuItem
                        class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[18px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                        @click="setSelectionTag('normal')">
                        <Icon icon="fa-solid:grip-lines" class="mr-2 w-[1em]" /> 正常
                    </ContextMenuItem>
                    <ContextMenuItem
                        class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[18px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                        @click="setSelectionTag('mute')">
                        <Icon icon="fa6-solid:xmarks-lines" class="mr-2 w-[1em]" /> 静音
                    </ContextMenuItem>
                    <ContextMenuItem
                        class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[18px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                        @click="setSelectionTag('delete')">
                        <Icon icon="fa6-solid:xmarks-lines" class="mr-2 w-[1em]" /> 删除
                    </ContextMenuItem>
                    <ContextMenuItem
                        class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[18px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                        @click="setSelectionTag('beep')">
                        <Icon icon="jam:mask-f" class="mr-2 w-[1em]" /> 打码
                    </ContextMenuItem>
                    <ContextMenuSeparator class="h-[1px] bg-green-300 m-[5px]" />
                    <ContextMenuItem
                        class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[18px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                        @click="setSelectionHot(true)">
                        <Icon icon="jam:mask-f" class="mr-2 w-[1em]" /> 金句
                    </ContextMenuItem>
                    <ContextMenuItem
                        class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[18px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                        @click="setSelectionHot(false)">
                        <Icon icon="jam:mask-f" class="mr-2 w-[1em]" /> 取消金句
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenuPortal>
        </ContextMenuRoot>
        <div v-if="store.stop" class="fixed right-1 bottom-1 z-10">
            <button @click="() => { store.stop(); store.stop = null }"
                class="w-[70px] h-[70px] rounded-full border-2 hover:bg-gray-600 bg-gray-600/70 text-white">stop</button>
        </div>
        <DialogRoot v-model:open="doAdjust" :modal="true">
            <DialogPortal>
                <DialogOverlay class="bg-blackA9 data-[state=open]:animate-overlayShow fixed inset-0 z-30" />
                <DialogContent
                    class="data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[640px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-white p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none z-[100]">
                    <DialogTitle class="text-mauve12 m-0 text-[17px] font-semibold">
                        片段精校
                    </DialogTitle>
                    <DialogDescription class="text-mauve11 mt-[10px] mb-5 text-[15px] leading-normal">
                        拖拽单词以调整其发生位置.
                    </DialogDescription>
                    <fieldset class="mb-[15px] flex items-center gap-5">
                        <WordAdjust :from="selWordStart" :to="selWordEnd" :projectid="project.id" />
                    </fieldset>
                    <DialogClose
                        class="text-grass11 hover:bg-green4 focus:shadow-green7 absolute top-[10px] right-[10px] inline-flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-full focus:shadow-[0_0_0_2px] focus:outline-none"
                        aria-label="Close">
                        <Icon icon="lucide:x" />
                    </DialogClose>
                </DialogContent>
            </DialogPortal>
        </DialogRoot>
        <div class="fixed right-[20px] top-[100px]  border-[1px] p-2 bg-gray-100">
            <div class="text-lg p-2 text-gray-600 antialiased font-bold">故事大纲：</div>
            <div class="max-h-[80vh] overflow-y-auto w-[300px]">
                <Draggable v-model="titlelist" item-key="title">
                    <template #item="{ element }">
                        <div @click="focusParagraph(element.index)"
                            class="text-sm bg-gray-100 cursor-grab border-2 mb-1 rounded p-2 text-ellipsis overflow-hidden whitespace-nowrap antialiased">
                            <span class="font-mono font-thin text-gray-500"> {{ element.duration }} </span>
                            &nbsp;
                            <span class="font-bold">{{ element.title }} </span>
                        </div>
                    </template>
                </Draggable>
            </div>
        </div>
    </div>
</template>
