<script setup>
import { ref, computed, watch } from 'vue'
import WordAdjust from '../component/WordAdjust.vue'
import Draggable from 'vuedraggable'
import { Icon } from '@iconify/vue'
import { useRoute } from 'vue-router';
import { useProjectStore } from '../stores/project';
const store = useProjectStore()
const route = useRoute()
const paraRefs = ref(null)
const project = ref(null);
const doAdjust = ref(false)
if (!store.list.length) {
    store.load().then(init)
} else {
    init()
}

const titlelist = computed({
    get: () => {
        if (!project.value) return []
        if (!project.value.paragraphs) return [];

        const result = []
        for (let index = 0; index < project.value.paragraphs.length; index++) {
            const p = project.value.paragraphs[index];
            if (p.comment) {
                result.push({
                    title: p.comment,
                    index,
                    sequence: p.sequence
                })
            }
        }
        const list = result.sort((a, b) =>
            (a.sequence || a.index) - (b.sequence || b.index)
        )
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

function adjustWords(idx) {
    doAdjust.value = true
    const unwatch = watch(doAdjust, () => {
        unwatch()
        store.updateParagraphsPieces(project.value, idx)
    })
}

function playSelection() {
    store.playWords(project.value, selWordStart.value, selWordEnd.value)
}

function setSelectionTag(paragraphIdx, tag) {
    if (selWordStart.value && selWordEnd.value) {
        console.log('set selection to', tag)
        store.setTag(project.value, paragraphIdx, selWordStart.value, selWordEnd.value, tag)
    }
}

function pieceMouseup() {
    const selection = getSelection()
    if (selection.type == 'Range') {
        let nodeBase = selection.baseNode
        if (nodeBase.nodeName !== 'SPAN') {
            nodeBase = nodeBase.parentNode
        }
        if (nodeBase.nodeName !== 'SPAN') return;
        let nodeExtent = selection.extentNode
        if (nodeExtent.nodeName !== 'SPAN') {
            nodeExtent = nodeExtent.parentNode
        }
        if (nodeExtent.nodeName !== 'SPAN') return;

        const paragraphIdxBase = parseInt(nodeBase.getAttribute('data-paragraph'))
        const paragraphIdxExtent = parseInt(nodeExtent.getAttribute('data-paragraph'))
        if (paragraphIdxBase !== paragraphIdxExtent) return;
        const pieceIdxBase = parseInt(nodeBase.getAttribute('data-piece'))
        const pieceIdxExtent = parseInt(nodeExtent.getAttribute('data-piece'))
        const vbase = selection.baseOffset
        const wordBase = store.getWordIndex(project.value, project.value.paragraphs[paragraphIdxBase].pieces[pieceIdxBase], vbase)
        const vextent = selection.extentOffset
        const wordExtent = store.getWordIndex(project.value, project.value.paragraphs[paragraphIdxExtent].pieces[pieceIdxExtent], vextent)
        selWordStart.value = Math.min(wordBase, wordExtent)
        selWordEnd.value = Math.max(wordBase, wordExtent)
        selParagraph.value = paragraphIdxBase
    } else {
        selWordStart.value = null
        selWordEnd.value = null
        selParagraph.value = null
    }
}

</script>
<template>
    <div v-if="project">
        <h1>Editor -- {{ project.name }}</h1>
        <div class="mr-[280px]">
            <div ref="paraRefs" v-for="(paragraph, idx) in project.paragraphs"
                class="text-justify leading-relaxed p-2 focus:outline-none " :key="paragraph.start">
                <ContextMenuRoot>
                    <ContextMenuTrigger :disabled="!selWordEnd">
                        <div>
                            <span contenteditable @keydown="preventEnter" @blur="setComment($event, idx)"
                                class="text-red-600 mr-2 px-1">
                                {{ `${paragraph.comment || '无注释'}` }}</span>
                            <Icon @click="store.playParagraph(project, paragraph)" icon="zondicons:play-outline"
                                class="inline mr-2" />
                            <span>&nbsp;&nbsp;</span>
                            <span v-for="(piece, pidx) in paragraph.pieces" :data-paragraph="idx" :data-piece="pidx"
                                :data-tag="piece.type || 'normal'" @mouseup="pieceMouseup"
                                @keydown="paragraphKeyDown($event, idx, piece)" tabindex="0"
                                class="focus:outline-none decoration-4 decoration-dashed data-[tag=delete]:line-through data-[tag=delete]:text-red-600">
                                {{
                                    piece.text }} </span>
                        </div>
                    </ContextMenuTrigger>
                    <ContextMenuPortal>
                        <ContextMenuContent
                            class=" min-w-[100px] z-30 bg-white outline-none rounded-md p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade"
                            :side-offset="5">
                            <ContextMenuItem
                                class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                                @click="playSelection(idx)">
                                播放
                            </ContextMenuItem>
                            <ContextMenuItem
                                class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                                @click="setSelectionTag(idx, 'delete')">
                                删除
                            </ContextMenuItem>
                            <ContextMenuItem
                                class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                                @click="setSelectionTag(idx, 'normal')">
                                正常
                            </ContextMenuItem>
                            <ContextMenuItem
                                class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                                @click="adjustWords(idx)">
                                调整
                            </ContextMenuItem>
                        </ContextMenuContent>
                    </ContextMenuPortal>
                </ContextMenuRoot>
            </div>
        </div>
        <div v-if="store.stop" class="fixed right-1 bottom-1">
            <button @click="() => { store.stop(); store.stop = null }"
                class="w-[70px] h-[70px] rounded-full border-2 hover:bg-gray-600 bg-gray-600/70 text-white">stop</button>
        </div>
        <DialogRoot v-model:open="doAdjust">
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
        <div class="fixed right-[20px] top-[20px]  ">
            <Draggable v-model="titlelist" item-key="title">
                <template #item="{ element }">
                    <div @click="focusParagraph(element.index)"
                        class="bg-gray-100 cursor-grab border-2 mb-1 rounded p-2 w-[240px] text-ellipsis overflow-hidden whitespace-nowrap">
                        {{ element.title }}</div>
                </template>
            </Draggable>
        </div>
    </div>
</template>