-- 用户表
CREATE TABLE IF NOT EXISTS users(
    user_id       SERIAL PRIMARY KEY,
    user_name     VARCHAR(50) UNIQUE NOT NULL,
    password      VARCHAR(255) NOT NULL
);

-- 族谱表
CREATE TABLE IF NOT EXISTS family_trees(
    tree_id       SERIAL PRIMARY KEY,
    tree_name     VARCHAR(100) NOT NULL,
    surname       VARCHAR(20) NOT NULL,
    creator_id    INTEGER NOT NULL REFERENCES users(user_id),
    create_time   TIMESTAMP DEFAULT NOW(),
    update_time   TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_tree_time CHECK (create_time <= update_time)
);

-- 成员表
CREATE TABLE IF NOT EXISTS members(
    member_id     SERIAL PRIMARY KEY,
    tree_id       INTEGER NOT NULL REFERENCES family_trees(tree_id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    gender        VARCHAR(10) CHECK (gender IN ('男', '女', 'unknown')),
    birth         DATE,
    death         DATE,
    bio           TEXT,
    father_id     INTEGER REFERENCES members(member_id),
    mother_id     INTEGER REFERENCES members(member_id),
    generation    INTEGER CHECK(generation >= 1),
    CONSTRAINT chk_life_time CHECK (birth <= death)
);

-- 协作表
CREATE TABLE IF NOT EXISTS collab(
    tree_id     INTEGER NOT NULL REFERENCES family_trees(tree_id) ON DELETE CASCADE,
    inviter_id  INTEGER NOT NULL REFERENCES users(user_id),
    invitee_id     INTEGER NOT NULL REFERENCES users(user_id),
    created_at  TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (tree_id, invitee_id) 
);

-- 婚姻表
CREATE TABLE IF NOT EXISTS marriages(
    marriage_id     SERIAL PRIMARY KEY,
    member1_id      INTEGER NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    member2_id      INTEGER NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    marry_date      DATE,
    divorce_date    DATE,
    CONSTRAINT chk_marriage_date CHECK (marry_date < divorce_date),
    CONSTRAINT chk_no_self  CHECK (member1_id <> member2_id),
    CONSTRAINT chk_pair_order CHECK (member1_id < member2_id),
    UNIQUE (member1_id, member2_id, marry_date)
);

-- 索引
