<template>
  <div class="upload-main">
    <div ref="drag" id="drag">
      <input type="file" name="file" @change="handleFileChange" />
    </div>
    <div class="upload-button">
      <el-button type="primary" size="mini" @click="uploadFile">上传</el-button>
    </div>
    <div class="progress">
      <el-progress
        :stroke-width="20"
        :text-inside="true"
        :percentage="uploadProgress"
      ></el-progress>
    </div>
  </div>
</template>
<script lang="ts">
import { computed, defineComponent, reactive, Ref, ref, onMounted } from "vue";
import { createFileChunk, calculateHashSample } from "@/utils/file";
export default defineComponent({
  name: "upload",
  setup() {
    const drag: Ref<HTMLElement | any> = ref(null);
    const state = reactive({
      file: {} as File,
      chunks: [],
      progress: 0,
    });
    onMounted(() => {
      // 文件拖拽功能
      drag.value.addEventListener("dragover", (e: Event) => {
        drag.value.style.borderColor = "red";
        e.preventDefault();
      });
      drag.value.addEventListener("dragleave", (e: Event) => {
        drag.value.style.borderColor = "#efefef";
        e.preventDefault();
      });
      drag.value.addEventListener("drop", (e: Event | any) => {
        const fileList = e?.dataTransfer?.files;
        drag.value.style.borderColor = "#efefef";
        state.file = fileList[0];
        e.preventDefault();
      });
    });
    // 计算属性：进度条
    const uploadProgress = computed(() => {
      return state.progress;
    });
    // 选择文件点击处理
    const handleFileChange = (e: any) => {
      const file = e?.target?.files;
      if (!file) return;
      state.file = file;
      console.log("选中的文件：", state.file);
    };
    // 使用webWork计算无损的文件hash
    const calculateHashWorker = (chunks: any[]) => {
      return new Promise((resolve) => {
        const worker = new Worker("/static/hash.js");
        worker.postMessage({ chunks });
        worker.onmessage = (e) => {
          const { progress, hash } = e.data;
          state.progress = Number(progress.toFixed(2));
          if (hash) {
            resolve(hash);
          }
        };
      });
    };
    // 点击上传
    const uploadFile = async () => {
      if (!state.file) return;
      const chunks = createFileChunk(state.file); // 文件切片
      console.log("当前的文件切片：", chunks);
      // 正常异步计算hash值，针对小文件
      // const hash = await calculateHashSample(state.file);
      // webWork计算hash
      const hash = await calculateHashWorker(chunks);
      console.log("当前的文件哈希：", hash);
    };
    return {
      drag,
      uploadProgress,
      handleFileChange,
      uploadFile,
    };
  },
});
</script>
<style scoped>
#drag {
  height: 100px;
  width: 500px;
  border: 1px solid #efefef;
}
.progress {
  margin: 16px 0;
}
.upload-button {
  margin: 16px 0;
}
</style>
