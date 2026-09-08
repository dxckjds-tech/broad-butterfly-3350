# AI Store Doctor · 3D 图标

把原来的正面发光图标做成有厚度、分层和高光的立体版本。

## 怎么看

用本地静态服务打开仓库根目录的 `index.html`：

```bash
python3 -m http.server 8080
```

然后打开 `http://localhost:8080`。

页面里有三块：

- **可交互立体图标**：CSS 3D 分层还原机器人、玻璃厚板和挤出文字。移动鼠标会转动，高光跟着走。
- **3D 静帧**：原图，加上正面、玻璃厚板、产品透视三张立体渲染。
- **前后对比**：拖滑杆对照原设计和立体厚板。

## 资源

| 文件 | 说明 |
| --- | --- |
| `assets/original-icon.png` | 原设计 |
| `assets/ai-store-doctor-3d-front.png` | 正面立体 |
| `assets/ai-store-doctor-3d.png` | 倾斜玻璃厚板 |
| `assets/ai-store-doctor-3d-tilt.png` | 产品透视 |
| `index.html` `styles.css` `app.js` | 可交互预览 |

颜色和厚度在 `styles.css` 顶部的 CSS 变量里改：`--neon`、`--thickness`、`--radius`。
