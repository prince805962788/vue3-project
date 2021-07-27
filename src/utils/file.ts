import sparkMD5 from "spark-md5";
const CHUNK_SIZE = 1 * 1024 * 1024; //切片默认大小1m
// 文件切片
export const createFileChunk = (file: File, size = CHUNK_SIZE) => {
  const chunks = [];
  let cur = 0;
  while (cur < file.size) {
    chunks.push({
      index: cur,
      chunk: file.slice(cur, cur + size),
    });
    cur = cur + size;
  }
  return chunks;
};
// 计算文件哈希
export const calculateHashSample = (file: File) => {
  // 布隆过滤器  判断一个数据存在与否
  // 1个G的文件，抽样后5M以内
  // hash一样，文件不一定一样
  // hash不一样，文件一定不一样
  return new Promise((resolve) => {
    const spark = new sparkMD5.ArrayBuffer(); //追加数组缓冲区。
    const reader = new FileReader(); //读取文件
    const size = file.size; //文件大小
    const offset = 2 * 1024 * 1024; // 计算hash的偏移量
    let chunks = [file.slice(0, offset)]; // 第一个2M，最后一个区块数据全要
    let cur = offset;
    while (cur < size) {
      if (cur + offset >= size) {
        // 最后一个区块
        chunks.push(file.slice(cur, cur + size));
      } else {
        // 中间的，取前中后各2各字节
        const mid = cur + offset / 2;
        const end = cur + offset;
        chunks.push(file.slice(cur, cur + 2));
        chunks.push(file.slice(mid, mid + 2));
        chunks.push(file.slice(end - 2, end));
      }
      cur = cur + offset;
    }
    //
    reader.readAsArrayBuffer(new Blob(chunks)); //读取文件blob数据
    reader.onload = (e) => {
      //读取完毕后放入缓存区
      spark.append(e.target?.result as ArrayBuffer);
      resolve(spark.end()); //计算完的hash结果返回
    };
  });
};
