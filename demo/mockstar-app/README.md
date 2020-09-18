# mockstar-app

本项目是由 [create-mockstar-app](https://www.npmjs.com/package/create-mockstar-app) 的基础模板初始化生成，相应的初始化命令如下：

```
$ npx create-mockstar-app mockstar-app 
```

本项目使用了 [MockStar](https://github.com/mockstarjs/mockstar) 来搭建的 mock server 服务。

## 1. 使用说明

### 1.1 初始化

这是一个独立的项目，首先需要安装依赖。

```bash
$ npm install
```

### 1.2 启动服务

提供了两种方式来启动服务，服务启动之后，可以打开 `http://localhost:9527` 进行管理端操作。

```bash
# 启动并运行在后端，即时关闭了控制台也不会关闭服务
$ npm start

# 启动，若关闭了控制台则服务也会被关闭，适合 debug 场景
$ npm run dev

# 关闭，主要用于关闭运行在后端的服务
$ npm run stop
```

### 1.3 新增桩对象 mocker

一个桩对象，我们成为一个 mocker，即对应一条接口请求，按照目录放置在 `mock_server` 文件夹下。

由于我们在 npm scripts 中增加了 `--watch` 参数，因此一般情况下这里的变更会及时刷新。但若有异常情况，可以先执行 `run run stop` ，在执行 `npm start`，若依然有问题，还可以删除 `build` 这个临时目录再重试一次。

## 2. 反馈

更多文档请阅读 [官方指南](https://mockstarjs.github.io/mockstar/) ，欢迎给我们 [提issue](https://github.com/mockstarjs/mockstar/issues) 和 [star](https://github.com/mockstarjs/mockstar) 。
