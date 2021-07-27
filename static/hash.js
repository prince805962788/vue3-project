self.importScripts("spark-md5.min.js");

self.onmessage = (e) => {
  // 接受主线程传递的数据
  const { chunks } = e.data;
  const spark = new self.SparkMD5.ArrayBuffer();

  let progress = 0; // 当前进度
  let count = 0; // 当前片段

  const loadNext = (index) => {
    if (count > chunks.length) return;
    const reader = new FileReader();
    reader.readAsArrayBuffer(chunks[index].file);
    reader.onload = (e) => {
      count++;
      spark.append(e.target.result);
      if (count === chunks.length) {
        self.postMessage({
          progress: 100, //当前进度100
          hash: spark.end(), //全部哈希值
        });
      } else {
        progress = progress + 100 / chunks.length;
        self.postMessage({
          progress,
        });
        loadNext(count);
      }
    };
  };
  loadNext(count);
};
