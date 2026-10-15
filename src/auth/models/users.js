'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SECRET = process.env.SECRET;

if (!SECRET) {
  throw new Error('Missing SECRET environment variable');
}

const userModel = (sequelize, DataTypes) => {
  const model = sequelize.define('Users', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('user', 'writer', 'editor', 'admin'), allowNull: false, defaultValue: 'user'},
    token: {
      type: DataTypes.VIRTUAL,
      get() {
        return jwt.sign(
          { username: this.username },
          SECRET,
          { algorithm: 'HS256' }
        );
      }
    },
    capabilities: {
      type: DataTypes.VIRTUAL,
      get() {
        const acl = {
          user: ['read'],
          writer: ['read', 'create'],
          editor: ['read', 'create', 'update'],
          admin: ['read', 'create', 'update', 'delete']
        };
        return acl[this.role];
      }
    }
  });

  model.prototype.toJSON = function () {
    return {
      id: this.id,
      username: this.username,
      role: this.role,
      capabilities: this.capabilities,
    };
  };

  model.beforeCreate(async (user) => {
    let hashedPass = await bcrypt.hash(user.password, 10);
    user.password = hashedPass;
  });

  model.authenticateBasic = async function (username, password) {
    const user = await this.findOne({ where: { username } });

    if (!user) {
      throw new Error('Invalid Login!');
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      throw new Error('Invalid Login');
    }
    
    return user;
  };

  model.authenticateToken = async function (token) {
    const payload = jwt.verify(token, SECRET, {
      algorithms: ['HS256'],
    });

    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof payload.username !== 'string' ||
      !payload.username
    ) {
      throw new Error('Invalid Login');
    }

    const user = await this.findOne({
      where: { username: payload.username } 
    });
    
    if (!user) {
      throw new Error("Invalid Login");
    }

    return user;
  };

  return model;
}

module.exports = userModel;
