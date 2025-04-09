# 创建仓位流程

1. 在MTRPools.tsx列表中选择一个池子，点击“Create Position”按钮，出现弹窗
2. 展示池子当前的价格 xxx/SOL xxx/USDC
3. 展示当前钱包的仓位代币数量： xxx SOL xxx USDC
4. 选择用于创建仓位的SOL数量（0.2SOL, 0.5SOL, 1SOL, 自定义）
5. 选则仓位策略
   - 如果选择“Spot”，则先用一半的SOL swap 到对应的代币，然后创建仓位
   - 如果选择“Curve”，则先用一半的SOL swap 到对应的代币，然后创建仓位
   - 如果选择“Bid Risk”，则用全部的SOL创建仓位
6. 点击“开始执行”按钮，根据配置执行弹窗展示步骤条UI，步骤必须顺序执行
   - 选择“Spot”或“Curve”，
     STEP1: 调用Jupiter API,用一半的SOL swap 到对应的代币，
       -步骤条对应的内容展示swap的详情，包括：
       - 交易对
       - 交易数量
       - 交易价格
       - 交易状态
       - 如果交易失败展示重试按钮
       - 如果交易成功，则自动进入STEP2
     STEP2: 调用Meteora API,用对应的代币+剩余数量的SOL创建仓位
       - 步骤条对应的内容展示创建仓位的详情，包括：
       - 仓位数量
       - 仓位价格
       - 仓位状态
       - 如果创建失败展示重试按钮
       - 如果创建成功，则自动进入STEP3
     STEP3: FINISH, 可以跳转至`positions`页面
   - 选择“Bid Risk”
     STEP1: 用输入数量的SOL 在Meteora创建仓位
     STEP2: FINISH, 可以跳转至`positions`页面


7. 创建仓位成功
   - 在`positions`页面列表中展示仓位信息
