const _ = require('lodash')
const expect = require('expect')
const request = require('supertest')
const { ObjectID } = require('mongodb')

const { app } = require('./../server')
const { Todo } = require('./../models/todo')
const { User } = require('./../models/user')
const { todos, populateTodos, users, populateUsers } = require('./seed/seed')


// clears database before each test case
beforeEach(populateUsers)
beforeEach(populateTodos)

describe('POST /todos', () => {
  it('should create a new todo', (done) => {
    const text = 'Test todo text'

    request(app)
      .post('/todos')
      .set('x-auth', users[0].tokens[0].token)
      .send({ text }) // sending text
      .expect(200)
      .expect((res) => {
        expect(res.body.text).toBe(text)
      })
      .end((err, res) => {
        if (err) done(err)

        Todo.find({ text }).then((todos) => {
          expect(todos.length).toBe(1)
          expect(todos[0].text).toBe(text)
          done()
        }).catch(e => done(e))
      })
  })

  it('should not create todo with invalid body data', (done) => {
    request(app)
      .post('/todos')
      .set('x-auth', users[0].tokens[0].token)
      .send({}) // send empty data
      .expect(400)
      .end((err, res) => {
        if (err) done(err)

        Todo.find().then((todos) => {
          expect(todos.length).toBe(2)
          done()
        }).catch(e => done(e))
      })
  })
})

describe('GET /todos', () => {
  it('should get all todos', (done) => {
    request(app)
      .get('/todos')
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .expect((res) => {
        expect(res.body.todos.length).toBe(1)
      })
      .end(done)
  })
})

describe('GET /todos/:id', () => {
  it('should return todo doc', (done) => {
    request(app)
      .get(`/todos/${todos[0]._id.toHexString()}`)
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .expect((res) => {
        expect(res.body.todo.text).toBe(todos[0].text)
      })
      .end(done)
  })

  it('should not return todo doc created by another user', (done) => {
    request(app)
      .get(`/todos/${todos[1]._id.toHexString()}`) // try to get second users id
      .set('x-auth', users[0].tokens[0].token) // but authenticate as a first user
      .expect(404)
      .end(done)
  })

  it('should return 404 if todo not found', (done) => {
    const hexId = new ObjectID().toHexString()

    // make sure you get 404 back
    request(app)
      .get(`/todos/${hexId}`)
      .set('x-auth', users[0].tokens[0].token)
      .expect(404)
      .end(done)
  })

  it('should return 404 for non-object ids', (done) => {
    // /todos/123 should fail
    request(app)
      .get('/todos/123abc')
      .set('x-auth', users[0].tokens[0].token)
      .expect(404)
      .end(done)
  })
})

describe('DELETE /todos/:id', () => {
  it('should remove a todo', (done) => {
    const hexId = todos[1]._id.toHexString()

    request(app)
      .delete(`/todos/${hexId}`)
      .set('x-auth', users[1].tokens[0].token)
      .expect(200)
      .expect((res) => {
        expect(res.body.todo._id).toBe(hexId)
      })
      .end((err, res) => {
        if (err) return done(err)

        // query database using findById toNotExist
        // expect(null).toNotExist()

        Todo.findById(hexId).then((todo) => {
          expect(todo).toNotExist()
          done()
        }).catch(e => done(e))
      })
  })

  it('should not remove a todo', (done) => {
    const hexId = todos[0]._id.toHexString()

    request(app)
      .delete(`/todos/${hexId}`)
      .set('x-auth', users[1].tokens[0].token)
      .expect(404)
      .end((err, res) => {
        if (err) return done(err)

        // query database using findById toNotExist
        // expect(null).toNotExist()
        Todo.findById(hexId).then((todo) => {
          expect(todo).toExist()
          done()
        }).catch(e => done(e))
      })
  })

  it('should return 404 if todo not found', (done) => {
    const hexId = new ObjectID().toHexString()

    // make sure you get 404 back
    request(app)
      .delete(`/todos/${hexId}`)
      .set('x-auth', users[1].tokens[0].token)
      .expect(404)
      .end(done)
  })

  it('should return 404 if object id is invalid', (done) => {
    request(app)
      .delete('/todos/someNotValidId')
      .set('x-auth', users[1].tokens[0].token)
      .expect(404)
      .end(done)
  })
})

describe('PATCH /todos/:id', () => {
  it('should update the todo', (done) => {
    // grab id of the first item
    const hexId = todos[0]._id.toHexString()
    const text = 'This should be the new text'

    // auth as first user

    // update text, set completed to true
    request(app)
      .patch(`/todos/${hexId}`)
      .set('x-auth', users[0].tokens[0].token)
      .send({
        completed: true,
        text,
      })
      .expect(200)// expect 200
      // expect text is changed, completed is true, completedAt is a number .toBeA
      .expect((res) => {
        expect(res.body.todo.text).toBe(text)
        expect(res.body.todo.completed).toBe(true)
        expect(res.body.todo.completedAt).toBeA('number')
      })
      .end(done)
  })

  // duplicate the test as a second user
  it('should not update the todo created by other user', (done) => {
    // grab id of the first item
    const hexId = todos[1]._id.toHexString()
    const text = 'This should be the new text'

    // auth as first user

    // update text, set completed to true
    request(app)
      .patch(`/todos/${hexId}`)
      .set('x-auth', users[0].tokens[0].token)
      .send({
        completed: true,
        text,
      })
      .expect(404)
      .end(done)
  })

  it('should clear completedAt when todo is not completed', (done) => {
    // grab id of second todo item
    const hexId = todos[1]._id.toHexString()
    const text = 'Feed my fish'
    // update text, set completed to false
    request(app)
      .patch(`/todos/${hexId}`)
      .set('x-auth', users[1].tokens[0].token)
      .send({
        completed: false,
        text,
      })
    // 200
      .expect(200)
    // text is changed, completed false, completedAt is null .toNotExist
      .expect((res) => {
        expect(res.body.todo.text).toBe(text)
        expect(res.body.todo.completed).toBe(false)
        expect(res.body.todo.completedAt).toNotExist()
      })
      .end(done)
  })
})

describe('GET /users/me', () => {
  it('should return user if authenticated', (done) => {
    request(app)
      .get('/users/me')
      // set a header, args('headerName', tokenValue)
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .expect((res) => {
        expect(res.body._id).toBe(users[0]._id.toHexString())
        expect(res.body.email).toBe(users[0].email)
      })
      .end(done)
  })

  it('should return 401 if not authenticated', (done) => {
    request(app)
      .get('/users/me')
      .expect(401)
      .expect((res) => {
        expect(res.body).toEqual({})
      })
      .end(done)
  })
})

describe('POST /users', () => {
  it('should create a user', (done) => {
    const email = 'example666@example.com'
    const password = 'password123'

    request(app)
      .post('/users')
      .send({ email, password })
      .expect(200)
      .expect((res) => {
        expect(res.headers['x-auth']).toExist()
        expect(res.body._id).toExist()
        expect(res.body.email).toBe(email)
      })
      .end((err) => {
        if (err) return done(err)

        // check that user is saved to the database
        User.findOne({ email }).then((user) => {
          expect(user).toExist()
          expect(user.password).toNotBe(password)
          done()
        }).catch(e => done(e))
      })
  })

  it('should return validation errors if request invalid', (done) => {
    // invalid email & password, expect 400
    const email = 'myemail.com'
    const password = '123'

    request(app)
      .post('/users')
      .send({ email, password })
      .expect(400)
      .end((err) => {
        if (err) return done(err)

        // check that user is not saved to the database
        User.findOne({ email }).then((user) => {
          expect(user).toNotExist()
          done()
        })
      })
  })

  it('should not create user if email in use', (done) => {
    const email = users[0].email
    const password = 'password123'

    request(app)
      .post('/users')
      .send({ email, password })
      .expect(400)
      .end(done)
  })
})

describe('POST /users/login', () => {
  it('should login user and return auth token', (done) => {
    request(app)
      .post('/users/login')
      .send({
        email: users[1].email,
        password: users[1].password,
      })
      .expect(200)
      .expect((res) => {
        expect(res.headers['x-auth']).toExist()
      })
      .end((err, res) => {
        if (err) return done(err)

        User.findById(users[1]._id).then((user) => {
          expect(user.tokens[1]).toInclude({
            access: 'auth',
            token: res.headers['x-auth'],
          })
          done()
        }).catch(e => done(e))
      })
  })

  it('should reject invalid login', (done) => {
    request(app)
      .post('/users/login')
      .send({
        email: users[1].email,
        password: `${users[1].password }1`,
      })
      .expect(400)
      .expect((res) => {
        expect(res.headers['x-auth']).toNotExist()
      })
      .end((err, res) => {
        if (err) return done(err)

        User.findById(users[1]._id).then((user) => {
          // expect token length === 0
          expect(user.tokens.length).toBe(1)
          done()
        }).catch(e => done(e))
      })
  })
})

describe('DELETE /users/me/token', () => {
  it('should remove auth token on logout', (done) => {
    request(app)
      .delete('/users/me/token') // DELETE /users/me/token
      .set('x-auth', users[0].tokens[0].token) // Set x-auth equal to token
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        // Find user, verify that length tokens array is 0  
        User.findById(users[0]._id).then((user) => {
          expect(user.tokens.length).toBe(0)
          done()
        }).catch(e => done(e))
      })
  })
})
