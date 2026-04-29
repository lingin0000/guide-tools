import { useState, useEffect } from 'react';
import { message } from 'antd';
import { invoke } from '@tauri-apps/api/core';

export const usePandoc = () => {
  const [pandocAvailable, setPandocAvailable] = useState<boolean>(false);

  const checkPandoc = async () => {
    try {
      const available = await invoke<boolean>("check_pandoc");
      setPandocAvailable(available);
      if (!available) {
        message.warning("Pandoc未安装或不可用，请先安装Pandoc");
      }
    } catch (error) {
      console.error("检查Pandoc失败:", error);
      message.error("检查Pandoc失败");
    }
  };

  useEffect(() => {
    checkPandoc();
  }, []);

  return {
    pandocAvailable,
    checkPandoc
  };
};