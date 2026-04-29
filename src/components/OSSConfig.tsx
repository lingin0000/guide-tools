import React from "react";
import { Modal, Form, Input, Typography, Button, Space, message } from "antd";
const { Text } = Typography;

interface OSSConfigProps {
  config: {
    access_key_id: string;
    access_key_secret: string;
    bucket: string;
    region: string;
    endpoint: string;
  };
  onConfigChange: (config: any) => void;
  triggerLabel?: string;
  triggerIcon?: React.ReactNode;
  buttonType?: "default" | "primary" | "dashed" | "link" | "text";
}

const OSSConfig: React.FC<OSSConfigProps> = ({
  config,
  onConfigChange,
  triggerLabel = "配置OSS",
  triggerIcon,
  buttonType = "default",
}) => {
  const [form] = Form.useForm();
  const [open, setOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportJson, setExportJson] = React.useState("");
  const [importOpen, setImportOpen] = React.useState(false);
  const [importJson, setImportJson] = React.useState("");

  // 同步外部config到表单
  React.useEffect(() => {
    form.setFieldsValue(config);
  }, [config, form]);

  const handleExportJson = () => {
    const values = form.getFieldsValue(true);
    const json = JSON.stringify(values, null, 2);
    setExportJson(json);
    setExportOpen(true);
  };

  const handleCopyExportJson = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      message.success("已复制配置 JSON");
    } catch (error) {
      message.error(`复制失败：${String(error)}`);
    }
  };

  const handleDownloadExportJson = () => {
    try {
      const blob = new Blob([exportJson], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "oss-config.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error(`下载失败：${String(error)}`);
    }
  };

  const handleOpenImport = () => {
    const values = form.getFieldsValue(true);
    setImportJson(JSON.stringify(values, null, 2));
    setImportOpen(true);
  };

  const handleApplyImport = async () => {
    try {
      const parsed = JSON.parse(importJson);
      form.setFieldsValue(parsed);
      const validated = await form.validateFields();
      onConfigChange(validated);
      setImportOpen(false);
      setOpen(false);
      message.success("已导入并应用 OSS 配置");
    } catch (error) {
      message.error(`导入失败：${String(error)}`);
    }
  };

  return (
    <>
      <Modal
        title="阿里云OSS配置"
        open={open}
        onCancel={() => {
          setOpen(false);
        }}
        onOk={() => {
          form.validateFields().then((values) => {
            onConfigChange(values);
            setOpen(false);
          });
        }}
        footer={(dom) => {
          return (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                width: "100%",
              }}
            >
              <Space>
                <Button onClick={handleExportJson}>导出 JSON</Button>
                <Button onClick={handleOpenImport}>导入 JSON</Button>
              </Space>
              {dom}
            </div>
          );
        }}
      >
        <Form form={form} layout="vertical" initialValues={config}>
          <Form.Item
            label="Access Key ID"
            name="access_key_id"
            rules={[{ required: true, message: "请输入 Access Key ID" }]}
          >
            <Input placeholder="Access Key ID" />
          </Form.Item>
          <Form.Item
            label="Access Key Secret"
            name="access_key_secret"
            rules={[{ required: true, message: "请输入 Access Key Secret" }]}
          >
            <Input.Password placeholder="Access Key Secret" />
          </Form.Item>
          <Form.Item
            label="Bucket名称"
            name="bucket"
            rules={[{ required: true, message: "请输入 Bucket 名称" }]}
          >
            <Input placeholder="Bucket名称" />
          </Form.Item>
          <Form.Item
            label="地域"
            name="region"
            rules={[{ required: true, message: "请输入地域，如 cn-hangzhou" }]}
          >
            <Input placeholder="地域 (如: cn-hangzhou)" />
          </Form.Item>
          <Form.Item label="Endpoint (可选)" name="endpoint">
            <Input placeholder="Endpoint (可选)" />
          </Form.Item>
          <Form.Item label="文件路径" name="file_path">
            <Input placeholder="文件路径" />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            请确保已开通阿里云OSS服务并获取相应的访问密钥
          </Text>
        </Form>
      </Modal>

      <Modal
        title="导出 OSS 配置 JSON"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        footer={
          <Space>
            <Button onClick={handleCopyExportJson} disabled={!exportJson}>
              复制
            </Button>
            <Button onClick={handleDownloadExportJson} disabled={!exportJson}>
              下载
            </Button>
            <Button type="primary" onClick={() => setExportOpen(false)}>
              关闭
            </Button>
          </Space>
        }
      >
        <Input.TextArea value={exportJson} readOnly autoSize={{ minRows: 10, maxRows: 18 }} />
      </Modal>

      <Modal
        title="导入 OSS 配置 JSON（一键配置）"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onOk={() => void handleApplyImport()}
        okText="应用配置"
        cancelText="取消"
      >
        <Input.TextArea
          value={importJson}
          onChange={(event) => setImportJson(event.target.value)}
          autoSize={{ minRows: 10, maxRows: 18 }}
          placeholder='粘贴配置 JSON，例如：{"access_key_id":"...","access_key_secret":"...","bucket":"...","region":"...","endpoint":"","file_path":""}'
        />
      </Modal>

      <Button
        type={buttonType}
        icon={triggerIcon}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
    </>
  );
};

export default OSSConfig;
