# Detailed important ML terminologies

___

&nbsp;&nbsp;&nbsp;&nbsp;As we've covered the basic definitions of artificial intelligence and machine learning in the last blog, this article will provide you with explanations of each attributes that make up machine learning models. We will cover terms that have to do with normal neural networks, neural nets for image classification, natural language processing, and tabular data processing.

&nbsp;&nbsp;&nbsp;&nbsp;In the last article we have shed light on basic terms like **loss, gradients, models, etc.**, we will also go over them again in detail in this blog. 

## Models

---

&nbsp;&nbsp;&nbsp;&nbsp;Models are essentially the whole neural network, the arrangemets of neurons, distributions of weights, layers, input and output, are all part of the machine learning model. There are many components in a machine learning model.

## &nbsp;&nbsp;&nbsp;&nbsp;Neuron

&nbsp;&nbsp;&nbsp;&nbsp;A neuron is a mathematical function that collects and classifies information according to a specific architecture.

## &nbsp;&nbsp;&nbsp;&nbsp;Multi-layered perceptron

&nbsp;&nbsp;&nbsp;&nbsp;When neurons are interconnected together, it is called a *layer*. When multiple layers are connected together, the input layer takes in input patterns, the output layer gives out signals or classifications of a specified purpose, and probably some other layers inbetween, we call that a **Multi-layered perceptron**.

![multi layered perceptron](blog/source3.png)

## Datasets

---

&nbsp;&nbsp;&nbsp;&nbsp;A dataset is a collection of data that will be used to train, validate, and test our models. A dataset consists of *features* and *labels*. The neural network learns to predict the labels from the input features.

&nbsp;&nbsp;&nbsp;&nbsp;Datasets, when loaded into a model, should be split into a training set, a validation set, and a test set. The training set contains data that will train our neural network. The input gets sent through the neurons and the network outputs a prediction, which will then be used to calculate the loss, make a gradient descent, and optimize the model again. After each training loop, the model gets a validation set input, which will be used to find metric scores, and further improve the model's functions.

&nbsp;&nbsp;&nbsp;&nbsp;After all training loops, when we're confident that we've got a good enough model, we will do a final sanity check with our test set, which will determine our model's accuracy, or any other metrics that we're interested in.

## &nbsp;&nbsp;&nbsp;&nbsp;Dataloaders

&nbsp;&nbsp;&nbsp;&nbsp;Dataloaders are tools that we use to load data into our training environment, to make sure we are passing in the input data in the correct format, in the correct shape.

## &nbsp;&nbsp;&nbsp;&nbsp;Data augmentation

&nbsp;&nbsp;&nbsp;&nbsp;Don't have enough data to train on? We can augment our already existing data  to make even more data to train on. Data augmentation is essentially giving our data modifications so that they look slightly different from our old data.

## Trainer

---

&nbsp;&nbsp;&nbsp;&nbsp;The trainer is a program that will pass the inputs from the datasets into our model, it will take care of handling losses, optimizing models, tracking the gradient descent, etc.There are a lot of components in the trainer that we will go over.

## &nbsp;&nbsp;&nbsp;&nbsp;Loss function

&nbsp;&nbsp;&nbsp;&nbsp;The loss functin in the neural network gives the difference of the model predictions to the real labels. From the loss function that gets put out in every training loop, we can track the changes in the loss value to make a gradient descent.

## &nbsp;&nbsp;&nbsp;&nbsp;Activation function

&nbsp;&nbsp;&nbsp;&nbsp;The activation function recieves the data from the hidden layers to generate an output. There are many activation functions that we can use for many appliations. ReLU (Rectified Linear Unit) is a popular activation function used to essentially remove negative units by turning them into 0

![ReLU](blog/source4.png)

## &nbsp;&nbsp;&nbsp;&nbsp;Metrics

&nbsp;&nbsp;&nbsp;&nbsp;Metrics are the values we use to measure the quality of our model. The most common metrics used to evaluate models are loss, accuracy, and f1-score.

## &nbsp;&nbsp;&nbsp;&nbsp;Optimizers

&nbsp;&nbsp;&nbsp;&nbsp;An optimizer in the model is a class that updates the weights in our model using the loss and gradient descents by doing operations to the weights with the gradient value.

This has been a deeper look into the terminologies as I understand it, in the next blog I will write about getting our data to train.