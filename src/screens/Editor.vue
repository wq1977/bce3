<script setup>
import { ref, computed, } from 'vue'
import WordAdjust from '../component/WordAdjust.vue'
import Draggable from 'vuedraggable'
import { Icon } from '@iconify/vue'
import { useRoute } from 'vue-router';
import { useProjectStore } from '../stores/project';
const store = useProjectStore()
const route = useRoute()
const paraRefs = ref(null)
const project = ref(null);
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
    paraRefs.value[idx].scrollIntoView({ behavior: "smooth" });
}

const selWordStart = ref(null)
const selWordEnd = ref(null)
const selParagraph = ref(null)

function setSelectionTag(paragraphIdx, tag) {
    if (selWordStart.value && selWordEnd.value) {
        store.setTag(project.value, paragraphIdx, selWordStart.value, selWordEnd.value, tag)
    }
}

function pieceMouseup(paragraphIdx, piece) {
    const selection = getSelection()
    if (selection.type == 'Range' && selection.baseNode.nodeValue == selection.extentNode.nodeValue) {
        console.log(getSelection())
        const vbase = selection.baseOffset
        const vextent = selection.extentOffset
        const wordBase = store.getWordIndex(project.value, piece, vbase)
        const wordExtent = store.getWordIndex(project.value, piece, vextent)
        selWordStart.value = Math.min(wordBase, wordExtent)
        selWordEnd.value = Math.max(wordBase, wordExtent)
        selParagraph.value = paragraphIdx
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
                    <ContextMenuTrigger>
                        <div>
                            <span contenteditable @keydown="preventEnter" @blur="setComment($event, idx)"
                                class="text-red-600 mr-2 px-1">
                                {{ `${paragraph.comment || '无注释'}` }}</span>
                            <Icon @click="store.playParagraph(project, idx)" icon="zondicons:play-outline"
                                class="inline mr-2" />
                            <span>&nbsp;&nbsp;</span>
                            <span v-for="piece in paragraph.pieces" :data-tag="piece.type || 'normal'"
                                @mouseup="pieceMouseup(idx, piece)" @keydown="paragraphKeyDown($event, idx, piece)"
                                tabindex="0"
                                class="focus:outline-none decoration-4 decoration-dashed data-[tag=delete]:line-through data-[tag=delete]:text-red-600">
                                {{
                                    piece.text }} </span>
                        </div>
                    </ContextMenuTrigger>
                    <ContextMenuPortal>
                        <ContextMenuContent
                            class=" min-w-[220px] z-30 bg-white outline-none rounded-md p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade"
                            :side-offset="5">

                            <ContextMenuItem value="delete"
                                class="group text-[13px] leading-none  rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none  data-[disabled]:pointer-events-none data-[highlighted]:bg-green-600 data-[highlighted]:text-green-400"
                                @click="setSelectionTag(idx, 'delete')">
                                删除
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
    </div>
    <div class="fixed right-[20px] top-[20px]  ">
        <Draggable v-model="titlelist" item-key="title">
            <template #item="{ element }">
                <div @click="focusParagraph(element.index)"
                    class="bg-gray-100 cursor-grab border-2 mb-1 rounded p-2 w-[240px] text-ellipsis overflow-hidden whitespace-nowrap">
                    {{ element.title }}</div>
            </template>
        </Draggable>
    </div>
</template>