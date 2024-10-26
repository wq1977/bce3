<script setup>
import { ref, onMounted, inject } from 'vue';
import { Icon } from '@iconify/vue';
const props = defineProps(['patch'])
const canvasRefL = ref(null)
const canvasRefR = ref(null)
const seekStart = ref(0)
const seekEnd = ref(0)
const emit = defineEmits(['afterChange'])
const showInputDialog = inject('showInputDialog')

function drawCanvas(canvas, buffer, offset, length) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const audioData = buffer.getChannelData(0); // Get data from first channel
    const step = Math.ceil(length / width);
    const amp = height / 2;

    // Calculate the overall volume
    let sum = 0;
    for (let i = 0; i < length; i++) {
        sum += Math.abs(audioData[i + offset]);
    }
    const average = sum / length;

    // Calculate scaling factor (adjust 0.5 to change sensitivity)
    const scale = Math.min(1 / average, 5) * 0.5;

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    // Set up the line style
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#333'; // Dark gray color for the waveform
    ctx.beginPath();

    // Start the line from the middle of the left side
    ctx.moveTo(0, amp);

    // Draw the waveform
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            const datum = audioData[(i * step + offset) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        // Apply scaling to the min and max values
        min *= scale;
        max *= scale;
        ctx.lineTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
    }

    // Draw the line
    ctx.stroke();

    // Draw the center line
    ctx.strokeStyle = '#999'; // Light gray color for the center line
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(width, amp);
    ctx.stroke();
}

function resizeCanvas() {
    if (!canvasRefL.value) return;
    if (!canvasRefR.value) return;
    if (!props.patch.buffer) {
        setTimeout(() => {
            resizeCanvas()
        }, 1000);
        return;
    }

    const total = Math.min(props.patch.buffer.sampleRate * 10, props.patch.buffer.length)

    {
        const canvas = canvasRefL.value
        const parent = canvas.parentNode
        const style = getComputedStyle(parent);
        canvas.width = parseInt(style.getPropertyValue('width'), 10);
        canvas.height = parseInt(style.getPropertyValue('height'), 10);
        seekStart.value = props.patch.start * canvas.width / total
        drawCanvas(canvas, props.patch.buffer, 0, total)
    }
    {
        const canvas = canvasRefR.value
        const parent = canvas.parentNode
        const style = getComputedStyle(parent);
        canvas.width = parseInt(style.getPropertyValue('width'), 10);
        canvas.height = parseInt(style.getPropertyValue('height'), 10);
        props.patch.end = props.patch.end || props.patch.buffer.length
        seekEnd.value = (total - (props.patch.buffer.length - props.patch.end)) * canvas.width / total
        drawCanvas(canvas, props.patch.buffer, props.patch.buffer.length - total, total)
    }
}

function setSeekStart(e) {
    const total = Math.min(props.patch.buffer.sampleRate * 10, props.patch.buffer.length)
    props.patch.start = Math.round(total * e.offsetX / e.target.width)
    const canvas = canvasRefL.value
    seekStart.value = props.patch.start * canvas.width / total
    emit('afterChange')
}

function setSeekEnd(e) {
    const total = Math.min(props.patch.buffer.sampleRate * 10, props.patch.buffer.length)
    props.patch.end = props.patch.buffer.length - Math.round(total * (e.target.width - e.offsetX) / e.target.width)
    const canvas = canvasRefR.value
    seekEnd.value = (total - (props.patch.buffer.length - props.patch.end)) * canvas.width / total
    emit('afterChange')
}

onMounted(() => {
    resizeCanvas()
})
addEventListener('load', resizeCanvas);
addEventListener('resize', resizeCanvas);

async function setTrackVolumn() {
    const result = await showInputDialog('设置音量', '请输入音量 ，1代表 原始音量', props.patch.volumn || 1)
    if (result) {
        props.patch.volumn = parseFloat(result)
        emit('afterChange')
    }
}

async function updatePatchName(e) {
    const newName = e.target.innerText
    props.patch.name = newName
    emit('afterChange')
}

</script>
<template>
    <div class="flex items-center">
        <span class="p-2" contenteditable @blur="updatePatchName">{{ props.patch.name }}</span>
        <Icon @click.stop="setTrackVolumn" icon="iconamoon:volume-up-duotone"
            class="group-hover:inline text-lg text-blue-300 hover:text-blue-500 mr-1" />
        <div class="w-100 p-2 border relative flex-1">
            <canvas ref="canvasRefL" @click="setSeekStart" class="absolute left-0 right-0 top-0 bottom-0"></canvas>
            <div class="w-[6px] bg-red-500 h-full absolute top-0" :style="{ left: `${seekStart - 3}px` }"></div>
        </div>
        <div class="w-100 p-2 border relative flex-1">
            <canvas ref="canvasRefR" @click="setSeekEnd" class="absolute left-0 right-0 top-0 bottom-0"></canvas>
            <div class="w-[6px] bg-red-500 h-full absolute top-0" :style="{ left: `${seekEnd - 3}px` }"></div>
        </div>
    </div>
</template>