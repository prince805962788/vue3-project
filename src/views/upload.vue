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
import {
  createFileChunk,
  calculateHashSample,
  appendToSpark,
} from "@/utils/file";
import SparkMD5 from "spark-md5";
import axios from "axios";
interface chunksTypes {
  hash: string;
  name: string;
  index: number;
  chunk: File;
  progress: number;
}
export default defineComponent({
  name: "upload",
  setup() {
    const drag: Ref<HTMLElement | any> = ref(null);
    const state = reactive({
      file: {} as File,
      chunks: <any[]>[],
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
    // 使用requestIdleCallback计算文件hash
    function calculateHashIdle(chunks: any[]) {
      return new Promise((resolve) => {
        const spark = new SparkMD5.ArrayBuffer();
        let count = 0;
        const workLoop = async (deadline: any) => {
          while (count < chunks.length && deadline.timeRemaining() > 1) {
            const sparkItem = await appendToSpark(chunks[count].file);
            spark.append(sparkItem as ArrayBuffer);
            count++;
            if (count < chunks.length) {
              state.progress = Number(
                ((100 * count) / chunks.length).toFixed(2)
              );
            } else {
              state.progress = 100;
              resolve(spark.end());
            }
          }
          window.requestIdleCallback(workLoop);
        };
        // 浏览器一旦空闲，就会调用workLoop
        window.requestIdleCallback(workLoop);
      });
    }
    // 使用webWork计算无损的文件hash
    function calculateHashWorker(chunks: any[]) {
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
    }
    // 点击上传
    const uploadFile = async () => {
      if (!state.file) return;
      const chunks = createFileChunk(state.file); // 文件切片
      console.log("当前的文件切片：", chunks);
      // 正常异步计算hash值，针对小文件
      // const hash = await calculateHashSample(state.file);
      // requestIdleCallback计算hash
      // const hash = await calculateHashIdle(chunks);
      // webWork计算hash
      const hash = await calculateHashWorker(chunks);
      console.log("当前的文件哈希：", hash);
      // 问一下后端，文件是否上传过，如果没有，是否有存在的切片
      const { data } = await axios.post("/api/checkfile", {
        hash: hash,
        ext: state.file.name.split(".").pop(),
      });
      const { uploaded, uploadedList } = data.data;
      if (uploaded) {
        // 秒传
      }
      state.chunks = chunks.map((chunk, index) => {
        const name = hash + "-" + index;
        return {
          hash,
          name,
          index,
          chunk: chunk.file,
          progress: uploadedList.includes(name) ? 100 : 0,
        };
      });
      uploadChunks(uploadedList);
    };
    async function uploadChunks(uploadedList: any) {
      const request = state.chunks
        .filter((chunk) => !uploadedList.includes(chunk.name)) //去除掉已经存在的切片
        .map((chunk) => {
          const form = new FormData();
          form.append("chunk", chunk.chunk);
          form.append("hash", chunk.hash);
          form.append("name", chunk.name);
          return { form, index: chunk.index, error: 0 };
        });
      // TCP慢启动，先上传一个初始区块，比如10KB，根据上传成功时间，决定下一个区块是20K，还是50K，还是5K
      // 在下一个一样的逻辑，可能编程100K，200K，或者2K
      // 上传可能报错
      // 报错之后，进度条变红，开始重试
      // 一个切片重试失败三次，整体全部终止
      await sendRequest(request, 4);
    }
    async function sendRequest(requestList: any[], limit = 4) {
      return new Promise((resolve, reject): void => {
        const len = requestList.length;
        let counter = 0;
        let isStop = false;
        //单个切片上传的函数
        const start = async () => {
          if (isStop) return;
          const task = requestList.shift(); // 每次队列头部弹出一个
          if (!task) return;
          const { form, index } = task;
          try {
            await axios.post("/uploadfile", form, {
              onUploadProgress: (progress) => {
                state.chunks[index].progress = Number(
                  ((progress.loaded / progress.total) * 100).toFixed(2)
                ); //当前这个切片的上传进度
              },
            });
            if (counter === len - 1) resolve(null); //最后一个切片完成，返回结果
            counter++;
            start(); //递归进行下一个任务
          } catch (error) {
            state.chunks[index].progress = -1; // 当前切片上传失败，进度重置-1
            if (task.error < 3) {
              task.error++;
              requestList.unshift(task); // 失败的请求切片重新放回头部
              start(); //重新执行任务
            } else {
              isStop = true; //错误3次，全部终止
              reject();
            }
          }
        };

        while (limit > 0) {
          start();
          limit--;
        }
      });
    }
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
